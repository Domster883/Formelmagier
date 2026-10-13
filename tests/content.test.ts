/**
 * Prüft alle Level-JSONs:
 *  1. Struktur (Karte, Marker, Verweise, Hinweise, Lektionen)
 *  2. Die Musterlösung jeder Rechenaufgabe wird mit dem Zauber nachgerechnet
 *  3. Unabhängige Kontrollrechnung (reines JS, ohne Einheiten-Engine)
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/content/levels';
import type { NumericTask, Spell } from '../src/content/types';
import { evaluateScalar, type Value } from '../src/engine/expr';
import { dimsEqual, isCoherentSI, judge, parseNumberList, parseQuantity, parseUnit, toQuantity } from '../src/engine/units';

function spellInputs(spell: Spell, inputs: Record<string, string>): Record<string, Value> {
  const vars: Record<string, Value> = {};
  for (const v of spell.vars) {
    const raw = inputs[v.symbol];
    if (raw === undefined) throw new Error(`Eingabe ${v.symbol} fehlt`);
    if (v.list) {
      const m = /^(.*?)([A-Za-zµ°%][^;]*)?$/.exec(raw.trim())!;
      const unit = (m[2] ?? '').trim();
      vars[v.symbol] = { list: parseNumberList(m[1]).map((x) => x * parseUnit(unit).factor), dims: parseUnit(unit).dims };
    } else {
      const q = parseQuantity(raw);
      if (v.unit !== '*') expect(dimsEqual(q.dims, parseUnit(v.unit).dims), `${spell.id}.${v.symbol} Dimension`).toBe(true);
      vars[v.symbol] = q;
    }
  }
  return vars;
}

/** Unabhängige Kontrollrechnung in SI, ohne Einheiten-Engine */
const INDEPENDENT: Record<string, () => number> = {
  'l1-regen': () => 0.112 / (13 * 0.01 * 3600),
  'l1-conv-ha': () => 215 * 100 * 100,
  'l1-conv-kpm': () => 11 * 9.81 * 1,
  'l1-conv-mwh': () => 223 * 1e6 * 3600,
  'l1-conv-nmjahr': () => (230 * 1e-9) / (365 * 24 * 3600),
  'l1-conv-kcal': () => (25 * 4200) / 60,
  'l1-gold-masse': () => 19.3 * 1e-3 / 1e-6 * (25 * 1e-6) * (3 * 1e-9),
  'l1-gold-rate': () => (200 * 1e-9) / 3600,
  'l1-gold-zeit': () => (19300 * 25e-6 * 3e-9) / ((200 * 1e-9) / 3600),
  'l1-vektor-kraft': () => Math.hypot(30, 40),
  'l1-vektor-weg': () => Math.hypot(300, 150),
  'l1-golem-mittel': () => (2.43 + 2.51 + 2.47 + 2.39 + 2.45) / 5,
  'l1-golem-sigma': () => {
    const x = [2.43, 2.51, 2.47, 2.39, 2.45];
    const m = x.reduce((a, b) => a + b) / x.length;
    return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
  },
  'l1-golem-unten': () => 2.45 - 2 * Math.sqrt(0.002),
  'l1-golem-oben': () => 2.45 + 2 * Math.sqrt(0.002),
  // Übungen der Mentorin
  'l1-ue-kmh': () => (18 * 1000) / 3600,
  'l1-ue-eis': () => 917 * 50 * 0.01 * 4e-3,
  'l1-ue-salz': () => 3 / (0.5e-3),
  'l1-ue-flieger': () => Math.hypot(12, 5),
  'l1-ue-mittel': () => (0.101 + 0.099 + 0.103 + 0.097) / 4,
  'l1-ue-sigma': () => {
    const x = [0.101, 0.099, 0.103, 0.097];
    const m = x.reduce((a, b) => a + b) / x.length;
    return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
  },
};

/** Unabhängige Kontrolle der Zwischenschritte (SI-Werte, in Reihenfolge) */
const GUIDE: Record<string, number[]> = {
  'l1-ue-kmh': [18 * 1000, 3600],
  'l1-ue-eis': [50 * 0.01, 4e-3],
  'l1-ue-salz': [0.5e-3],
  'l1-ue-flieger': [12 ** 2 + 5 ** 2],
  'l1-ue-mittel': [0.101 + 0.099 + 0.103 + 0.097],
  'l1-ue-sigma': [2 * 0.001 ** 2 + 2 * 0.003 ** 2, (2 * 0.001 ** 2 + 2 * 0.003 ** 2) / 3],
};

for (const level of LEVELS) {
  describe(`Level ${level.id}: ${level.title}`, () => {
    const spells = new Map(level.spells.map((s) => [s.id, s]));
    const tasks = new Map(level.tasks.map((t) => [t.id, t]));

    it('Karte ist rechteckig und Marker sind eindeutig', () => {
      const w = level.map[0].length;
      level.map.forEach((row, i) => expect(row.length, `Zeile ${i}`).toBe(w));
      const markers = [level.mentor.marker, level.merchant.marker, 'P', ...(level.shrine ? [level.shrine.marker] : []), ...level.encounters.map((e) => e.marker)];
      for (const m of markers) {
        const count = level.map.join('').split(m).length - 1;
        expect(count, `Marker ${m}`).toBe(1);
      }
      for (const ch of new Set(level.map.join(''))) {
        expect(ch in level.legend || markers.includes(ch), `unbekanntes Kartenzeichen ${ch}`).toBe(true);
      }
    });

    it('Lektionen: max. 5 Sätze, schalten alle Zauber frei', () => {
      const unlocked = new Set<string>();
      for (const l of level.mentor.lessons) {
        expect(l.lines.length).toBeLessThanOrEqual(5);
        l.unlocks.forEach((u) => {
          expect(spells.has(u), u).toBe(true);
          unlocked.add(u);
        });
      }
      expect([...spells.keys()].every((s) => unlocked.has(s))).toBe(true);
    });

    it('Begegnungen verweisen auf existierende Aufgaben und freigeschaltete Zauber', () => {
      const used = new Set<string>();
      for (const e of level.encounters) {
        expect(e.lesson).toBeLessThanOrEqual(level.mentor.lessons.length);
        const available = new Set(level.mentor.lessons.slice(0, e.lesson).flatMap((l) => l.unlocks));
        for (const id of e.tasks) {
          const t = tasks.get(id);
          expect(t, id).toBeDefined();
          expect(used.has(id), `${id} doppelt verwendet`).toBe(false);
          used.add(id);
          if (t!.type === 'numeric') t!.spells.forEach((s) => expect(available.has(s), `${id}: ${s} zu früh`).toBe(true));
        }
        if (e.kind !== 'crystal') expect(e.monster).toBeDefined();
      }
      expect(level.encounters.filter((e) => e.kind === 'boss')).toHaveLength(1);
      expect(used.size).toBe(level.tasks.length);
    });

    it('Lektionen: Beispiel und Übung vorhanden, Übungen nutzen nur bekannte Zauber', () => {
      const practice = new Map((level.practice ?? []).map((t) => [t.id, t]));
      const used = new Set<string>();
      const known = new Set<string>();
      for (const l of level.mentor.lessons) {
        l.unlocks.forEach((u) => known.add(u));
        expect(l.example, `${l.title}: Beispiel fehlt`).toBeDefined();
        expect(l.example!.steps.length).toBeGreaterThan(1);
        expect(l.practice?.length, `${l.title}: Übung fehlt`).toBeGreaterThan(0);
        for (const id of l.practice ?? []) {
          const t = practice.get(id);
          expect(t, id).toBeDefined();
          expect(tasks.has(id), `${id} ist auch eine Prüfungsaufgabe`).toBe(false);
          expect(used.has(id), `${id} doppelt verwendet`).toBe(false);
          used.add(id);
          if (t!.type === 'numeric') t!.spells.forEach((s) => expect(known.has(s), `${id}: ${s} zu früh`).toBe(true));
        }
      }
      expect(used.size).toBe(practice.size);
    });

    for (const t of level.practice ?? []) {
      if (t.type !== 'numeric') continue;
      it(`Übung ${t.id}: Zwischenschritte stimmen`, () => {
        const want = GUIDE[t.id] ?? [];
        expect(t.guide?.length ?? 0, 'Kontrollwerte in GUIDE fehlen').toBe(want.length);
        t.guide?.forEach((g, i) => {
          const q = toQuantity(g.answer.value, g.answer.unit);
          expect(Math.abs(q.value - want[i]) / Math.abs(want[i]), `${t.id} Schritt ${i + 1}`).toBeLessThan(g.tolerance ?? 0.01);
          if (g.requireSI) expect(isCoherentSI(g.answer.unit)).toBe(true);
        });
      });
    }

    for (const t of [...level.tasks, ...(level.practice ?? [])]) {
      const isPractice = !tasks.has(t.id);
      it(`Aufgabe ${t.id}: Pflichtfelder`, () => {
        expect(t.hints).toHaveLength(3);
        expect(t.solutionSteps.length).toBeGreaterThan(0);
        expect(t.xp).toBeGreaterThan(0);
        if (!isPractice) expect(t.gold).toBeGreaterThan(0);
        expect(t.story.length).toBeGreaterThan(20);
        if (t.type === 'choice') {
          expect(t.correct).toBeGreaterThanOrEqual(0);
          expect(t.correct).toBeLessThan(t.options.length);
        }
      });

      if (t.type !== 'numeric') continue;
      const nt = t as NumericTask;

      it(`Aufgabe ${t.id}: Musterlösung mit Zauber nachgerechnet`, () => {
        expect(nt.spells).toContain(nt.solution.spell);
        const spell = spells.get(nt.solution.spell)!;
        const result = evaluateScalar(spell.expr, spellInputs(spell, nt.solution.inputs));
        const expected = toQuantity(nt.answer.value, nt.answer.unit);
        if (spell.result.unit !== '*') expect(dimsEqual(parseUnit(spell.result.unit).dims, expected.dims)).toBe(true);
        expect(judge(result, expected, nt.tolerance).kind).toBe('hit');
        if (nt.requireSI) expect(isCoherentSI(nt.answer.unit)).toBe(true);
      });

      it(`Aufgabe ${t.id}: unabhängige Kontrollrechnung`, () => {
        const f = INDEPENDENT[t.id];
        expect(f, 'Kontrollrechnung fehlt in tests/content.test.ts').toBeDefined();
        const si = toQuantity(nt.answer.value, nt.answer.unit).value;
        expect(Math.abs(f() - si) / Math.abs(si)).toBeLessThan(nt.tolerance);
      });

      it(`Aufgabe ${t.id}: typische Fehler werden nicht als richtig gewertet`, () => {
        const expected = toQuantity(nt.answer.value, nt.answer.unit);
        for (const m of nt.commonMistakes ?? []) {
          expect(judge(toQuantity(m.value, m.unit), expected, nt.tolerance).kind).not.toBe('hit');
        }
      });
    }
  });
}
