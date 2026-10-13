/** Grimoire/Codex, Mentor, Händler, Statistik */
import { CONSTANTS, ITEMS, LEVELS } from '../content/levels';
import type { LevelData } from '../content/types';
import { describeDims, formatNumber, parseUnit, PREFIX_TABLE, sup, UnitError } from '../engine/units';
import { game, RANKS } from '../game/state';
import { h, openModal, showDialog, toast } from './dom';

// ---------------------------------------------------------------------------
// Grimoire / Codex
// ---------------------------------------------------------------------------

export function openGrimoire() {
  const m = openModal({ title: '📖 Grimoire & Codex', wide: true });
  const tabs: [string, () => HTMLElement][] = [
    ['Zauber', spellsTab],
    ['Theorie', theoryTab],
    ['Einheiten-Labor', labTab],
    ['Vorsilben', prefixTab],
  ];
  if (game.has('amulet')) tabs.push(['Konstanten', constantsTab]);
  const bar = h('div', { class: 'tabs' });
  const panel = h('div', { class: 'tab-panel' });
  const show = (i: number) => {
    bar.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', i === j));
    panel.innerHTML = '';
    panel.append(tabs[i][1]());
  };
  tabs.forEach(([name], i) => bar.append(h('button', { onclick: () => show(i) }, name)));
  m.body.append(bar, panel);
  show(0);
}

function spellsTab(): HTMLElement {
  const box = h('div', { class: 'spell-list' });
  let any = false;
  for (const level of LEVELS) {
    const spells = level.spells.filter((s) => game.knows(s.id));
    if (!spells.length) continue;
    any = true;
    box.append(h('h3', {}, `Level ${level.id} – ${level.world}`));
    for (const s of spells) {
      box.append(
        h(
          'div',
          { class: 'spell-card' },
          h('div', { class: 'row' }, h('b', { class: 'spell-name' }, s.name), h('code', {}, s.formula), h('small', {}, `${s.manaCost} ✦`)),
          h('p', { class: 'small' }, s.description),
          h(
            'ul',
            { class: 'vars' },
            ...s.vars.map((v) => h('li', {}, h('b', {}, v.display), ` – ${v.label}`, v.unit !== '*' && v.unit !== '1' ? ` [${unitPretty(v.unit)}]` : '')),
            h('li', {}, h('b', {}, s.result.display), ` – ${s.result.label}`, s.result.unit !== '*' ? ` [${unitPretty(s.result.unit)}]` : ''),
          ),
        ),
      );
    }
  }
  if (!any) box.append(h('p', {}, 'Noch leer. Die Mentorin lehrt dich deine ersten Zauber.'));
  return box;
}

function unitPretty(u: string): string {
  return u.replace(/\^(-?\d+)/g, (_, e) => sup(Number(e))).replace(/\*/g, '·');
}

function theoryTab(): HTMLElement {
  const box = h('div', {});
  let any = false;
  for (const level of LEVELS) {
    const heard = game.data.lessons[level.id] ?? 0;
    level.mentor.lessons.slice(0, heard).forEach((l) => {
      any = true;
      box.append(h('div', { class: 'lesson' }, h('h3', {}, l.title), ...l.lines.map((line) => h('p', {}, line))));
    });
  }
  if (!any) box.append(h('p', {}, 'Hier sammeln sich die Lektionen deiner Mentoren.'));
  return box;
}

function labTab(): HTMLElement {
  const input = h('input', { type: 'text', placeholder: 'Einheit eingeben, z. B. kWh, km/h, g/cm³, N·m', autocomplete: 'off', spellcheck: 'false' });
  const out = h('div', { class: 'lab-out' });
  const upd = () => {
    const v = input.value.trim();
    if (!v) {
      out.textContent = '';
      return;
    }
    try {
      const u = parseUnit(v);
      out.innerHTML = '';
      out.append(h('div', {}, `1 ${v} = ${formatNumber(u.factor, 4)} · (SI)`), h('div', {}, `Dimension: ${describeDims(u.dims)}`));
    } catch (e) {
      out.textContent = e instanceof UnitError ? e.message : String(e);
    }
  };
  input.addEventListener('input', upd);
  return h(
    'div',
    {},
    h('p', { class: 'small' }, 'Im Einheiten-Labor kannst du jede Einheit zerlegen lassen. Schreibweisen: m², m^2 oder m2; Multiplikation mit · * oder Leerzeichen; alles nach „/“ steht im Nenner (kg/m²s = kg/(m²·s)).'),
    input,
    out,
  );
}

function prefixTab(): HTMLElement {
  return h(
    'table',
    { class: 'given' },
    h('tr', {}, h('th', {}, 'Vorsilbe'), h('th', {}, 'Zeichen'), h('th', {}, 'Faktor')),
    ...PREFIX_TABLE.map((p) => h('tr', {}, h('td', {}, p.name), h('td', {}, p.symbol), h('td', {}, `10${sup(p.exp)}`))),
  );
}

function constantsTab(): HTMLElement {
  return h(
    'table',
    { class: 'given' },
    h('tr', {}, h('th', {}, 'Symbol'), h('th', {}, 'Konstante'), h('th', {}, 'Wert')),
    ...CONSTANTS.map((c) => h('tr', {}, h('td', {}, c.symbol), h('td', {}, c.name), h('td', {}, `${c.value} ${c.unit}`))),
  );
}

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

export function talkToMentor(level: LevelData, onDone: () => void) {
  const heard = game.data.lessons[level.id] ?? 0;
  const lessons = level.mentor.lessons;
  if (heard >= lessons.length) {
    const m = openModal({ title: level.mentor.name, onClose: onDone });
    m.body.append(
      h('div', { class: 'dialog' }, h('div', { class: 'portrait mentor' }), h('div', { class: 'dialog-main' }, h('div', { class: 'speaker' }, level.mentor.name), h('p', { class: 'dialog-text' }, level.mentor.afterAll))),
      h('p', { class: 'small' }, 'Möchtest du eine Lektion wiederholen?'),
      h('div', { class: 'row wrap' }, ...lessons.map((l) => h('button', { class: 'ghost', onclick: () => showDialog(level.mentor.name, l.lines, { title: l.title, portrait: 'mentor' }) }, l.title))),
    );
    return;
  }
  const lesson = lessons[heard];
  const lines = heard === 0 ? [level.mentor.greeting, ...lesson.lines] : lesson.lines;
  showDialog(level.mentor.name, lines, {
    title: lesson.title,
    portrait: 'mentor',
    onDone: () => {
      game.data.lessons[level.id] = heard + 1;
      game.learn(lesson.unlocks);
      game.save();
      game.emit();
      const names = lesson.unlocks.map((id) => level.spells.find((s) => s.id === id)?.name).filter(Boolean);
      if (names.length) toast(`Neue Zauber im Grimoire: ${names.join(', ')}`, 'gold', 4000);
      onDone();
    },
  });
}

// ---------------------------------------------------------------------------
// Händler
// ---------------------------------------------------------------------------

export function openShop(level: LevelData) {
  const m = openModal({ title: `🛒 ${level.merchant.name}`, wide: true });
  const render = () => {
    m.body.innerHTML = '';
    m.body.append(
      h('div', { class: 'dialog' }, h('div', { class: 'portrait merchant' }), h('div', { class: 'dialog-main' }, h('div', { class: 'speaker' }, level.merchant.name), h('p', { class: 'dialog-text' }, level.merchant.greeting))),
      h('p', {}, `Dein Gold: 🪙 ${game.data.gold}`),
    );
    const list = h('div', { class: 'shop' });
    for (const it of ITEMS) {
      const owned = game.has(it.id);
      const btn = h('button', { class: owned ? 'ghost' : 'primary', disabled: owned || game.data.gold < it.price }, owned ? 'Ausgerüstet ✓' : `Kaufen (${it.price} 🪙)`);
      btn.addEventListener('click', () => {
        if (game.data.gold < it.price || owned) return;
        game.data.gold -= it.price;
        game.data.items.push(it.id);
        game.save();
        game.emit();
        toast(`${it.name} ausgerüstet!`, 'gold');
        render();
      });
      list.append(h('div', { class: `shop-item item-${it.id}` }, h('div', { class: 'item-icon' }), h('div', { class: 'item-main' }, h('b', {}, it.name), h('p', { class: 'small' }, it.description), h('small', { class: 'effect' }, `Effekt: ${it.effect}`)), btn));
    }
    m.body.append(list, h('p', { class: 'small' }, 'Tipp: Gold bekommst du für gelöste Aufgaben. Mit Hilfe der vollständigen Lösung gibt es nur halb so viel.'));
  };
  render();
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

export function openStats() {
  const m = openModal({ title: '📊 Statistik – Was sitzt, was nicht?', wide: true });
  const d = game.data;
  const next = game.nextRankXp;
  m.body.append(
    h('div', { class: 'stat-head' }, h('div', {}, h('b', {}, d.name), ` – ${game.rank}`), h('div', {}, `${d.xp} XP` + (next ? ` (nächster Rang bei ${next})` : '')), h('div', {}, `🪙 ${d.gold}`)),
    h('div', { class: 'small' }, `Ränge: ${RANKS.map((r) => `${r.name} (${r.xp})`).join(' → ')}`),
  );
  const topics = Object.entries(d.stats);
  if (!topics.length) {
    m.body.append(h('p', {}, 'Noch keine Daten – löse ein paar Aufgaben!'));
  } else {
    const tbl = h('table', { class: 'given stats' }, h('tr', {}, h('th', {}, 'Thema'), h('th', {}, 'Trefferquote'), h('th', {}, 'Versuche'), h('th', {}, 'Einheitenfehler'), h('th', {}, 'Größenordnung'), h('th', {}, 'Hilfen')));
    topics
      .map(([t, s]) => ({ t, s, rate: s.attempts ? s.correct / s.attempts : 0 }))
      .sort((a, b) => a.rate - b.rate)
      .forEach(({ t, s, rate }) => {
        const cls = rate >= 0.75 ? 'good' : rate >= 0.5 ? 'mid' : 'bad';
        tbl.append(
          h('tr', {}, h('td', {}, t), h('td', {}, h('div', { class: `bar rate ${cls}` }, h('div', { class: 'fill', style: `width:${Math.round(rate * 100)}%` }), h('span', {}, `${Math.round(rate * 100)} %`))), h('td', {}, String(s.attempts)), h('td', {}, String(s.unitErrors)), h('td', {}, String(s.magnitudeErrors)), h('td', {}, String(s.hintsUsed))),
        );
      });
    m.body.append(tbl, h('p', { class: 'small' }, 'Themen oben in der Liste solltest du vor der Prüfung noch einmal üben (Training: bereits gelöste Begegnungen erneut betreten).'));
  }
  const cards = Object.values(d.cards);
  if (cards.length) {
    const boxes = [1, 2, 3, 4, 5].map((b) => cards.filter((c) => c.box === b).length);
    m.body.append(h('h3', {}, 'Lernkarten (Leitner-Boxen)'), h('div', { class: 'row' }, ...boxes.map((n, i) => h('div', { class: 'boxcount' }, h('b', {}, String(n)), h('small', {}, `Box ${i + 1}`)))));
  }
}
