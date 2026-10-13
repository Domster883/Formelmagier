/**
 * Begegnungen: Rätsel-Kristalle, Monster und Bosse.
 * Hier passiert die Kern-Mechanik: Zauber wählen, Werte mit Einheit
 * einsetzen, Ergebnis angeben – und die Einheiten-Magie prüft alles.
 */
import type { ChoiceTask, Encounter, GuideStep, LevelData, NumericTask, Spell, Task } from '../content/types';
import { evaluateScalar, type Value } from '../engine/expr';
import {
  UnitError,
  describeDims,
  dimName,
  dimsEqual,
  explainMismatch,
  formatDims,
  formatNumber,
  isCoherentSI,
  judge,
  parseNumber,
  parseNumberList,
  parseUnit,
  sup,
  toQuantity,
  PREFIX_TABLE,
} from '../engine/units';
import { game } from '../game/state';
import { h, openModal, toast } from './dom';
import { openFlashcards } from './flashcards';

const HELP_XP = [1, 0.8, 0.6, 0.25];
const FAIL_MANA = 3;

type Mode = 'normal' | 'training' | 'review' | 'practice';

interface Session {
  level: LevelData;
  enc: Encounter;
  mode: Mode;
  /** schon gelöst (Training/Wiederholung): kein Fortschritt, weniger Belohnung */
  training: boolean;
  queue: Task[];
  monsterHp: number;
  monsterMax: number;
  robeUsed: boolean;
  onFinish: (won: boolean) => void;
}

export function openEncounter(level: LevelData, enc: Encounter, onFinish: (won: boolean) => void, forceMode?: Mode) {
  const mode: Mode = forceMode ?? (game.isEncounterDone(enc.id) ? 'training' : 'normal');
  const training = mode !== 'normal';
  if (training && mode !== 'practice') game.advanceTaskRound();
  const all = enc.tasks.map((id) => level.tasks.find((t) => t.id === id)!);
  const queue = training ? all : all.filter((t) => !game.isTaskDone(t.id));
  const max = enc.monster?.hp ?? 0;
  const perTask = max / all.length;
  const s: Session = {
    level,
    enc,
    mode,
    training,
    queue,
    monsterMax: max,
    monsterHp: training ? max : Math.round(max - perTask * (all.length - queue.length)),
    robeUsed: false,
    onFinish,
  };
  let won = false;
  const modal = openModal({
    title: enc.name + (mode === 'training' ? ' (Training)' : ''),
    wide: true,
    className: `encounter kind-${enc.kind}`,
    onClose: () => onFinish(won),
  });

  const header = h('div', { class: 'enc-header' });
  const content = h('div', { class: 'enc-content' });
  modal.body.append(header, content);

  const renderHeader = () => {
    header.innerHTML = '';
    if (enc.monster) {
      const pct = Math.max(0, (s.monsterHp / s.monsterMax) * 100);
      header.append(
        h(
          'div',
          { class: 'foe' },
          h('div', { class: `foe-sprite ${enc.kind}`, style: `--foe:${enc.monster.color}` }),
          h('div', { class: 'foe-info' }, h('strong', {}, enc.monster.name), h('div', { class: 'bar hpbar' }, h('div', { class: 'fill', style: `width:${pct}%` })), h('small', {}, `${Math.max(0, Math.round(s.monsterHp))} / ${s.monsterMax} LP`)),
        ),
      );
    } else {
      header.append(h('div', { class: 'foe' }, h('div', { class: `foe-sprite ${mode === 'practice' ? 'practice' : 'crystal'}` }), h('div', { class: 'foe-info' }, h('strong', {}, enc.name), h('small', {}, mode === 'practice' ? 'Übung – Fehler kosten nichts' : 'Rätsel'))));
    }
    header.append(
      h(
        'div',
        { class: 'me' },
        h('div', {}, `❤ ${game.data.hp} / ${game.maxHp}`),
        h('div', {}, `✦ Mana ${game.data.mana} / ${game.maxMana}`),
        game.has('robe') ? h('div', { class: 'small' }, s.robeUsed ? 'Robe: verbraucht' : 'Robe: bereit') : null,
      ),
    );
  };

  const finishEncounter = () => {
    won = true;
    if (!s.training) {
      game.completeEncounter(enc.id);
      game.advanceTaskRound();
      if (enc.kind === 'boss' && !game.data.bossDefeated.includes(level.id)) game.data.bossDefeated.push(level.id);
    }
    game.save();
    game.emit();
    content.innerHTML = '';
    content.append(
      h('div', { class: 'victory' }, h('div', { class: 'big' }, mode === 'practice' ? '🎓 Übung geschafft!' : enc.kind === 'crystal' ? '✨ Gelöst!' : '⚔ Sieg!'), h('p', {}, enc.outro)),
      h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: () => modal.close() }, mode === 'practice' ? 'Weiter ▸' : 'Zurück zur Karte')),
    );
    renderHeader();
  };

  const nextTask = () => {
    renderHeader();
    const task = s.queue.shift();
    if (!task) return finishEncounter();
    content.innerHTML = '';
    renderTask(s, task, content, {
      refreshHeader: renderHeader,
      onSolved: (dmg, weak) => {
        if (enc.monster) {
          const floor = weak ? (s.monsterMax / all.length) * s.queue.length + 1 : 0;
          s.monsterHp = Math.max(floor, s.monsterHp - dmg);
          renderHeader();
        }
      },
      next: nextTask,
      defeat: () => {
        content.innerHTML = '';
        game.data.hp = Math.ceil(game.maxHp / 2);
        game.save();
        game.emit();
        content.append(
          h('div', { class: 'victory defeat' }, h('div', { class: 'big' }, '💫 Ohnmächtig!'), h('p', {}, `${enc.monster?.name ?? 'Der Gegner'} war diesmal stärker. Deine bereits gelösten Aufgaben bleiben erhalten. Lies dir die Hinweise durch, meditiere über Lernkarten und versuch es erneut!`)),
          h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: () => modal.close() }, 'Zurück zur Karte')),
        );
      },
    });
  };

  // Intro
  content.append(
    h('p', { class: 'story' }, enc.intro),
    mode === 'training' ? h('p', { class: 'note' }, 'Training: Du hast diese Begegnung schon gemeistert. Es gibt nur 25 % XP und kein Gold – aber jede Wiederholung festigt den Stoff.') : '',
    mode === 'practice' ? practiceIntro() : '',
    mode === 'review' ? h('p', { class: 'note' }, `${queue.length} Aufgaben zur Wiederholung. Sauber gelöst (ohne Fehlversuch und ohne Hilfe) wandern sie in eine höhere Box und kommen seltener wieder – sonst kommen sie bald erneut dran.`) : '',
    h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: nextTask }, mode === 'practice' ? 'Übung beginnen ✎' : enc.kind === 'crystal' ? 'Rätsel beginnen' : 'Kampf beginnen ⚔')),
  );
  renderHeader();
}

function practiceIntro(): HTMLElement {
  return h(
    'div',
    { class: 'note practice-note' },
    h('p', {}, 'Hier übst du gemeinsam mit der Mentorin. Fehlversuche kosten weder Mana noch Leben, und alle Hilfen sind gratis.'),
    h('b', {}, 'So wirkst du einen Zauber:'),
    h(
      'ol',
      {},
      h('li', {}, 'Bei manchen Übungen rechnest du erst Zwischenschritte (meist das Umrechnen in SI).'),
      h('li', {}, 'Wähle den passenden Zauber aus deinem Grimoire.'),
      h('li', {}, 'Trag jeden gegebenen Wert mit Zahl UND Einheit ein, z. B. 50 und dm².'),
      h('li', {}, 'Gib dein Ergebnis mit Einheit an und klicke auf „Zaubern“.'),
    ),
  );
}

interface TaskCtx {
  refreshHeader: () => void;
  onSolved: (damage: number, weak?: boolean) => void;
  next: () => void;
  defeat: () => void;
}

function renderTask(s: Session, task: Task, root: HTMLElement, ctx: TaskCtx) {
  let helpLevel = 0;
  let failedOnce = false;
  const practice = s.mode === 'practice';
  // Übungen fließen nicht in die Statistik ein
  const stat = practice ? { attempts: 0, correct: 0, unitErrors: 0, magnitudeErrors: 0, hintsUsed: 0 } : game.stat(task.topic);
  const perTaskDamage = s.monsterMax / s.enc.tasks.length;

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const helpBox = h('div', { class: 'help-box' });
  const helpBtn = h('button', { class: 'ghost' }, 'Hinweis 1 💡');
  const updateHelpBtn = () => {
    const labels = ['Hinweis 1 💡', 'Lösungsweg-Skizze 🗺', 'Vollständige Lösung 📜'];
    if (helpLevel >= 3) helpBtn.setAttribute('disabled', '');
    else helpBtn.textContent = practice ? labels[helpLevel] : `${labels[helpLevel]} (XP ×${HELP_XP[helpLevel + 1]})`;
  };
  helpBtn.addEventListener('click', () => {
    if (helpLevel >= 3) return;
    helpLevel++;
    stat.hintsUsed++;
    helpBox.innerHTML = '';
    for (let i = 0; i < helpLevel; i++) {
      const label = ['Hinweis', 'Lösungsweg', 'Lösung'][i];
      helpBox.append(h('div', { class: `hint h${i}` }, h('b', {}, label + ': '), task.hints[i]));
    }
    if (helpLevel === 3) helpBox.append(h('ol', { class: 'steps' }, ...task.solutionSteps.map((st) => h('li', {}, st))));
    updateHelpBtn();
  });
  updateHelpBtn();

  const fail = (msg: string, kind: 'fizzle' | 'weak' | 'miss', extra?: HTMLElement) => {
    if (practice) {
      failedOnce = true;
      const title = { fizzle: '💨 Der Zauber verpufft!', weak: '🌫 Fast – die Größenordnung stimmt nicht!', miss: '✗ Noch nicht ganz!' }[kind];
      feedback.className = `feedback bad ${kind}`;
      feedback.innerHTML = '';
      feedback.append(h('strong', {}, title), h('p', {}, msg), extra ?? '', h('p', { class: 'small' }, 'Kein Problem – in der Übung kostet ein Fehler nichts. Probier es noch einmal oder hol dir einen Hinweis.'));
      reveal(feedback);
      return;
    }
    if (!failedOnce) {
      failedOnce = true;
      game.reviewTask(task.id, false);
    }
    const robe = game.has('robe') && !s.robeUsed && s.enc.kind !== 'crystal';
    let penalty = '';
    if (robe) {
      s.robeUsed = true;
      penalty = 'Die Robe der Gelassenheit fängt die Folgen dieses Fehlversuchs ab.';
    } else {
      game.spendMana(FAIL_MANA);
      penalty = `−${FAIL_MANA} Mana für den Fehlversuch.`;
      if (s.enc.monster) {
        game.damage(s.enc.monster.attack);
        penalty += ` ${s.enc.monster.name} schlägt zurück: −${s.enc.monster.attack} ❤`;
        document.querySelector('.modal.encounter')?.classList.add('shake');
        setTimeout(() => document.querySelector('.modal.encounter')?.classList.remove('shake'), 400);
      }
    }
    if (kind === 'weak' && s.enc.monster) {
      // Treffer mit falscher Größenordnung: schwacher Schaden
      ctx.onSolved(perTaskDamage * 0.1, true);
    }
    game.save();
    game.emit();
    ctx.refreshHeader();
    const title = { fizzle: '💨 Der Zauber verpufft!', weak: '🌫 Der Zauber trifft nur schwach!', miss: '✗ Daneben!' }[kind];
    feedback.className = `feedback bad ${kind}`;
    feedback.innerHTML = '';
    feedback.append(h('strong', {}, title), h('p', {}, msg), extra ?? '', h('p', { class: 'small' }, penalty));
    reveal(feedback);
    if (game.data.hp <= 0) {
      setTimeout(ctx.defeat, 900);
    }
  };

  const succeed = (msg: string) => {
    if (practice) {
      const first = !game.data.practiced.includes(task.id);
      if (first) game.data.practiced.push(task.id);
      const xp = first ? task.xp : 0;
      const up = xp ? game.addXp(xp) : false;
      game.save();
      game.emit();
      feedback.className = 'feedback good';
      feedback.innerHTML = '';
      feedback.append(
        h('strong', {}, '✨ Richtig!'),
        h('p', {}, msg),
        xp ? h('p', { class: 'reward' }, `+${xp} XP`) : '',
        h('div', { class: 'worked' }, h('b', {}, 'So geht der Lösungsweg:'), h('ol', { class: 'steps' }, ...task.solutionSteps.map((st) => h('li', {}, st)))),
        h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: ctx.next }, 'Weiter ▸')),
      );
      (feedback.querySelector('button.primary') as HTMLButtonElement)?.focus();
      reveal(feedback);
      if (up) toast(`Neuer Rang: ${game.rank}! Mana und Leben aufgefüllt.`, 'gold', 4000);
      root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.task-input button, .task-input input').forEach((b) => (b.disabled = true));
      return;
    }
    const clean = !failedOnce && helpLevel === 0;
    const mult = s.mode === 'review' ? 0.5 * HELP_XP[helpLevel] : s.training ? 0.25 : HELP_XP[helpLevel];
    const xp = Math.round(task.xp * mult);
    const gold = s.mode === 'review' ? (clean ? Math.round(task.gold * 0.25) : 0) : s.training ? 0 : Math.round(task.gold * (helpLevel === 3 ? 0.5 : 1));
    game.reviewTask(task.id, clean);
    stat.correct++;
    const up = game.addXp(xp);
    game.addGold(gold);
    if (!s.training) game.completeTask(task.id);
    ctx.onSolved(perTaskDamage);
    game.save();
    game.emit();
    feedback.className = 'feedback good';
    feedback.innerHTML = '';
    feedback.append(
      h('strong', {}, s.enc.monster ? '⚡ Volltreffer!' : '✨ Richtig!'),
      h('p', {}, msg),
      h('p', { class: 'reward' }, `+${xp} XP` + (gold ? `  ·  +${gold} Gold` : '')),
      h('details', {}, h('summary', {}, 'Lösungsweg ansehen'), h('ol', { class: 'steps' }, ...task.solutionSteps.map((st) => h('li', {}, st)))),
      h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: ctx.next }, 'Weiter ▸')),
    );
    (feedback.querySelector('button.primary') as HTMLButtonElement)?.focus();
    reveal(feedback);
    if (up) toast(`Neuer Rang: ${game.rank}! Mana und Leben aufgefüllt.`, 'gold', 4000);
    root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.task-input button, .task-input input').forEach((b) => (b.disabled = true));
  };

  root.append(
    h('div', { class: 'task-head' }, h('span', { class: 'topic' }, task.topic), h('h3', {}, task.title)),
    h('p', { class: 'story' }, task.story),
    h('p', { class: 'question' }, task.question),
  );

  // Gegebene Werte müssen bewusst von Hand (mit Einheit) übertragen werden – Wiederholung ist gewollt.
  const given = task.given ?? [];
  if (given.length) {
    root.append(
      h('table', { class: 'given' }, h('tr', {}, h('th', {}, 'Gegeben'), h('th', {}, 'Wert')), ...given.map((g) => h('tr', {}, h('td', {}, g.label), h('td', {}, `${g.value} ${g.unit}`)))),
    );
  }

  const inputArea = h('div', { class: 'task-input' });
  root.append(inputArea, h('div', { class: 'row' }, helpBtn), helpBox, feedback);

  if (task.type === 'choice') {
    renderChoice(task, inputArea, stat, succeed, fail);
  } else if (practice && task.guide?.length) {
    const guideArea = h('div', { class: 'guide' });
    const spellArea = h('div', {});
    inputArea.append(guideArea, spellArea);
    renderGuide(task.guide, guideArea, () => renderNumeric(s, task, spellArea, stat, succeed, fail));
  } else {
    renderNumeric(s, task, inputArea, stat, succeed, fail);
  }
}

// ---------------------------------------------------------------------------
// Auswahlfragen
// ---------------------------------------------------------------------------

function renderChoice(
  task: ChoiceTask,
  area: HTMLElement,
  stat: ReturnType<typeof game.stat>,
  succeed: (m: string) => void,
  fail: (m: string, k: 'miss') => void,
) {
  const grid = h('div', { class: 'choices' });
  task.options.forEach((opt, i) => {
    const b = h('button', { class: 'choice' }, `${String.fromCharCode(65 + i)}) ${opt}`);
    b.addEventListener('click', () => {
      stat.attempts++;
      if (i === task.correct) {
        b.classList.add('right');
        succeed(task.explanation);
      } else {
        b.classList.add('wrong');
        b.disabled = true;
        fail('Das stimmt nicht. Denk noch einmal nach – oder nutze einen Hinweis.', 'miss');
      }
    });
    grid.append(b);
  });
  area.append(grid);
}

// ---------------------------------------------------------------------------
// Rechenaufgaben: Zauber wirken
// ---------------------------------------------------------------------------

interface FieldPair {
  value: HTMLInputElement;
  unit: HTMLInputElement;
  preview: HTMLElement;
}

function renderNumeric(
  s: Session,
  task: NumericTask,
  area: HTMLElement,
  stat: ReturnType<typeof game.stat>,
  succeed: (m: string) => void,
  fail: (m: string, k: 'fizzle' | 'weak' | 'miss', extra?: HTMLElement) => void,
) {
  const known = s.level.spells.filter((sp) => game.knows(sp.id));
  const picker = h('div', { class: 'spell-picker' });
  const form = h('div', { class: 'spell-form' });
  area.append(h('div', { class: 'label' }, s.mode === 'practice' ? 'Wähle den passenden Zauber aus deinem Grimoire:' : 'Wähle einen Zauber aus deinem Grimoire:'), picker, form);
  if (!known.length) {
    picker.append(h('p', { class: 'note' }, 'Du kennst noch keine Zauber. Sprich mit der Mentorin!'));
    return;
  }
  known.forEach((sp) => {
    const b = h('button', { class: 'spell-btn' }, h('b', {}, sp.name), h('span', {}, sp.formula), h('small', {}, `${sp.manaCost} ✦`));
    b.addEventListener('click', () => {
      picker.querySelectorAll('.spell-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      buildForm(sp);
    });
    picker.append(b);
  });

  let lastFocused: FieldPair | null = null;

  const buildForm = (spell: Spell) => {
    form.innerHTML = '';
    lastFocused = null;
    const fields: { v: Spell['vars'][number]; f: FieldPair }[] = [];

    form.append(h('div', { class: 'formula' }, h('span', { class: 'spell-name' }, spell.name), h('code', {}, spell.formula)), h('p', { class: 'small' }, spell.description));

    const mkPair = (label: string, expectUnit: string, list = false): FieldPair => {
      const value = h('input', { type: 'text', inputmode: 'decimal', placeholder: list ? 'z. B. 2,43; 2,51; …' : 'Zahlenwert', class: list ? 'val list' : 'val', autocomplete: 'off', spellcheck: 'false' });
      const unit = h('input', { type: 'text', placeholder: 'Einheit', class: 'unit', autocomplete: 'off', spellcheck: 'false' });
      const preview = h('div', { class: 'preview' });
      const pair = { value, unit, preview };
      const focus = () => (lastFocused = pair);
      value.addEventListener('focus', focus);
      unit.addEventListener('focus', focus);
      const update = () => updatePreview(pair);
      value.addEventListener('input', update);
      unit.addEventListener('input', update);
      void label;
      void expectUnit;
      return pair;
    };

    const grid = h('div', { class: 'var-grid' });
    for (const v of spell.vars) {
      const f = mkPair(v.label, v.unit, v.list);
      fields.push({ v, f });
      // Die erwartete SI-Einheit verrät nur die Brille der Dimensionen
      const expect = v.unit === '1' ? 'dimensionslos' : v.unit === '*' || !game.has('glasses') ? '' : `👓 SI: ${formatDims(parseUnit(v.unit).dims)}`;
      grid.append(h('label', { class: 'var-label' }, h('b', {}, v.display), ` ${v.label}`, expect ? h('small', {}, ` (${expect})`) : null), h('div', { class: 'pair' }, f.value, v.unit === '1' ? h('span', { class: 'unit-none' }, '—') : f.unit), f.preview);
      if (v.unit === '1') f.unit.value = '';
    }
    const res = mkPair('Ergebnis', task.answer.unit);
    grid.append(
      h('label', { class: 'var-label result' }, h('b', {}, spell.result.display), ` ${spell.result.label} = `),
      h('div', { class: 'pair' }, res.value, res.unit),
      res.preview,
    );
    form.append(h('div', { class: 'label' }, 'Setze die Werte mit Einheit ein und gib dein Ergebnis an:'), grid);

    // Sonderzeichen-Leiste
    const chars = ['µ', '²', '³', '⁻¹', '·', '/', '(', ')', '10^'];
    form.append(
      h(
        'div',
        { class: 'charbar' },
        ...chars.map((c) =>
          h(
            'button',
            {
              class: 'tiny',
              tabindex: -1,
              onmousedown: (e: Event) => e.preventDefault(),
              onclick: () => insertChar(c),
            },
            c,
          ),
        ),
      ),
    );

    if (game.has('wand')) {
      form.append(
        h('div', { class: 'wand-table' }, h('b', {}, '🪄 Vorsilben: '), ...PREFIX_TABLE.map((p) => h('span', {}, `${p.symbol} = 10${sup(p.exp)}`))),
      );
    }

    const castBtn = h('button', { class: 'primary cast' }, s.mode === 'practice' ? '✦ Zaubern (Übung, kostenlos)' : `✦ Zaubern (${spell.manaCost} Mana)`);
    form.append(h('div', { class: 'row end' }, castBtn));
    castBtn.addEventListener('click', () => cast(spell, fields, res));
    form.querySelectorAll('input').forEach((inp) =>
      inp.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') castBtn.click();
      }),
    );
    fields[0]?.f.value.focus();
  };

  const insertChar = (c: string) => {
    const el = document.activeElement as HTMLInputElement | null;
    const target = el && el.tagName === 'INPUT' ? el : lastFocused?.unit;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.value = target.value.slice(0, start) + c + target.value.slice(end);
    target.setSelectionRange(start + c.length, start + c.length);
    target.focus();
    target.dispatchEvent(new Event('input'));
  };

  const updatePreview = (p: FieldPair) => {
    p.preview.innerHTML = '';
    const unitStr = p.unit.value.trim();
    if (!game.has('glasses') && !game.has('wand')) return;
    if (!unitStr) return;
    try {
      const u = parseUnit(unitStr);
      const parts: string[] = [];
      if (game.has('glasses')) parts.push(`👓 ${describeDims(u.dims)}`);
      if (game.has('wand')) {
        const v = p.value.classList.contains('list') ? NaN : parseNumber(p.value.value);
        parts.push(
          Number.isNaN(v)
            ? `🪄 1 ${unitStr} = ${formatNumber(u.factor, 4)} ${formatDims(u.dims)}`
            : `🪄 ${p.value.value} ${unitStr} = ${formatNumber(v * u.factor, 4)} ${formatDims(u.dims)}`,
        );
      }
      p.preview.textContent = parts.join('   ');
    } catch (e) {
      p.preview.textContent = (e as Error).message;
    }
  };

  const cast = (spell: Spell, fields: { v: Spell['vars'][number]; f: FieldPair }[], res: FieldPair) => {
    // 1) Eingaben lesen (Tippfehler kosten nichts)
    const vars: Record<string, Value> = {};
    try {
      for (const { v, f } of fields) {
        const unitStr = v.unit === '1' ? '' : f.unit.value;
        const u = parseUnit(unitStr);
        if (v.list) {
          const nums = parseNumberList(f.value.value);
          if (!nums.length || nums.some(Number.isNaN)) throw new UnitError(`Bei ${v.display}: Gib die Messwerte als Zahlen getrennt durch „;“ ein.`);
          vars[v.symbol] = { list: nums.map((x) => x * u.factor), dims: u.dims };
        } else {
          const n = parseNumber(f.value.value);
          if (Number.isNaN(n)) throw new UnitError(`Bei ${v.display} (${v.label}) fehlt ein gültiger Zahlenwert.`);
          vars[v.symbol] = { value: n * u.factor, dims: u.dims };
        }
      }
      const rv = parseNumber(res.value.value);
      if (Number.isNaN(rv)) throw new UnitError('Gib dein Ergebnis als Zahl ein (Dezimalkomma ist erlaubt, Zehnerpotenz z. B. als 2,39e-4 oder 2,39·10^-4).');
      parseUnit(res.unit.value);
    } catch (e) {
      feedbackOnly(e instanceof UnitError ? e.message : String(e));
      return;
    }

    // 2) Mana (in der Übung gratis)
    if (s.mode !== 'practice' && game.data.mana < spell.manaCost) {
      const btn = h('button', { class: 'ghost', onclick: () => openFlashcards({ mode: 'meditate' }) }, '🧘 Meditieren (Lernkarten → Mana)');
      feedbackOnly('Zu wenig Mana! Meditiere über Lernkarten, um Mana zurückzugewinnen.', btn);
      return;
    }
    if (s.mode !== 'practice') game.spendMana(spell.manaCost);
    stat.attempts++;

    // 3) passt der Zauber zur Situation?
    if (!task.spells.includes(spell.id)) {
      const want = toQuantity(1, task.answer.unit).dims;
      fail(`„${spell.name}“ passt nicht zu dieser Situation. Gesucht ist ${dimName(want) ? 'eine Größe vom Typ ' + dimName(want) : 'eine Größe der Dimension ' + formatDims(want)}. Welcher Zauber liefert genau das?`, 'fizzle');
      return;
    }

    // 4) Dimensionen der eingesetzten Werte
    for (const { v } of fields) {
      if (v.unit === '*') continue;
      const want = parseUnit(v.unit).dims;
      const got = vars[v.symbol].dims;
      if (!dimsEqual(want, got)) {
        stat.unitErrors++;
        fail(`Beim Einsetzen von ${v.display} (${v.label}): ${explainMismatch(want, got)}`, 'fizzle');
        return;
      }
    }
    let computed;
    try {
      computed = evaluateScalar(spell.expr, vars);
    } catch (e) {
      stat.unitErrors++;
      fail((e as Error).message, 'fizzle');
      return;
    }

    // 5) Ergebnis prüfen
    const answer = toQuantity(parseNumber(res.value.value), res.unit.value);
    const expected = toQuantity(task.answer.value, task.answer.unit);
    if (!dimsEqual(answer.dims, expected.dims)) {
      stat.unitErrors++;
      fail(`Die Einheit deines Ergebnisses passt nicht. ${explainMismatch(expected.dims, answer.dims)}`, 'fizzle');
      return;
    }
    const verdict = judge(answer, expected, task.tolerance);
    if (verdict.kind === 'hit') {
      if (task.requireSI && !isCoherentSI(res.unit.value)) {
        stat.magnitudeErrors++;
        fail(`Der Wert stimmt, aber die Aufgabe verlangt kohärente SI-Einheiten – ohne Vorsilben und ohne h, min, g … (z. B. ${prettyUnit(task.answer.unit)}). Rechne noch um!`, 'weak');
        return;
      }
      succeed(`Dein Ergebnis ${res.value.value} ${res.unit.value} ist korrekt.`);
      return;
    }
    if (verdict.kind === 'weak') {
      stat.magnitudeErrors++;
      fail(
        `Deine Ziffern stimmen, aber du liegst um den Faktor 10${sup(verdict.power)} daneben. Prüfe Vorsilben und Zehnerpotenzen – besonders bei Flächen und Volumen (z. B. 1 dm² = 10⁻² m², 1 cm³ = 10⁻⁶ m³).`,
        'weak',
      );
      return;
    }
    // Fehldiagnose
    const mistake = task.commonMistakes?.find((m) => judge(answer, toQuantity(m.value, m.unit), task.tolerance).kind === 'hit');
    if (mistake) {
      fail(mistake.feedback, 'miss');
      return;
    }
    const fromInputs = judge(computed, expected, task.tolerance);
    if (fromInputs.kind === 'hit') {
      fail('Deine eingesetzten Werte und Einheiten stimmen – der Fehler steckt in der Rechnung oder in der Umrechnung des Ergebnisses. Rechne noch einmal nach!', 'miss');
    } else if (fromInputs.kind === 'weak') {
      stat.magnitudeErrors++;
      fail(`Schon beim Einsetzen stimmt eine Größenordnung nicht (Faktor 10${sup(fromInputs.power)}). Kontrolliere die Vorsilben der eingesetzten Werte.`, 'miss');
    } else {
      fail('Mindestens ein eingesetzter Wert passt nicht zur Situation. Vergleiche deine Eingaben mit den gegebenen Größen.', 'miss');
    }
  };

  const feedbackOnly = (msg: string, extra?: HTMLElement) => {
    const fb = area.parentElement!.querySelector('.feedback') as HTMLElement;
    fb.className = 'feedback warn';
    fb.innerHTML = '';
    fb.append(h('strong', {}, '✎ Eingabe prüfen'), h('p', {}, msg), extra ?? '');
    reveal(fb);
  };
}

// ---------------------------------------------------------------------------
// Angeleitete Zwischenschritte (nur in Übungen)
// ---------------------------------------------------------------------------

function renderGuide(steps: GuideStep[], area: HTMLElement, onDone: () => void) {
  area.append(h('div', { class: 'label' }, 'Schritt für Schritt – zuerst die Zwischenschritte:'));
  const list = h('ol', { class: 'guide-steps' });
  area.append(list);

  const showStep = (i: number) => {
    if (i >= steps.length) {
      onDone();
      return;
    }
    const step = steps[i];
    const value = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Zahlenwert', class: 'val', autocomplete: 'off', spellcheck: 'false' });
    const unit = h('input', { type: 'text', placeholder: 'Einheit', class: 'unit', autocomplete: 'off', spellcheck: 'false' });
    const check = h('button', { class: 'primary' }, 'Prüfen');
    const show = h('button', { class: 'ghost' }, 'Zeig es mir');
    const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const li = h('li', { class: 'guide-step' }, h('p', {}, step.prompt), h('div', { class: 'row wrap' }, h('div', { class: 'pair' }, value, unit), check, show), fb);
    list.append(li);
    value.focus();

    const done = (how: 'solved' | 'shown') => {
      [value, unit, check, show].forEach((el) => (el.disabled = true));
      li.classList.add(how);
      fb.className = how === 'solved' ? 'feedback good' : 'feedback warn';
      fb.innerHTML = '';
      fb.append(h('strong', {}, how === 'solved' ? '✓ Richtig! ' : '👁 So geht es: '), step.explain);
      showStep(i + 1);
    };
    const say = (msg: string) => {
      fb.className = 'feedback bad';
      fb.innerHTML = '';
      fb.append(h('p', {}, msg), h('p', { class: 'small' }, `💡 ${step.hint}`));
      reveal(fb);
    };

    check.addEventListener('click', () => {
      const n = parseNumber(value.value);
      if (Number.isNaN(n)) return say('Gib einen Zahlenwert ein (Dezimalkomma ist erlaubt).');
      let answer;
      try {
        answer = toQuantity(n, unit.value);
      } catch (e) {
        return say(e instanceof UnitError ? e.message : String(e));
      }
      const expected = toQuantity(step.answer.value, step.answer.unit);
      const verdict = judge(answer, expected, step.tolerance ?? 0.01);
      if (verdict.kind === 'fizzle') return say(`Die Einheit passt nicht. ${explainMismatch(expected.dims, answer.dims)}`);
      if (verdict.kind === 'hit') {
        if (step.requireSI && !isCoherentSI(unit.value)) return say(`Der Wert stimmt – aber schreib ihn in SI-Einheiten ohne Vorsilbe (${prettyUnit(step.answer.unit)}).`);
        return done('solved');
      }
      if (verdict.kind === 'weak') return say(`Die Ziffern stimmen, aber du liegst um den Faktor 10${sup(verdict.power)} daneben.`);
      say('Das stimmt noch nicht.');
    });
    show.addEventListener('click', () => {
      value.value = formatNumber(step.answer.value, 4);
      unit.value = prettyUnit(step.answer.unit);
      done('shown');
    });
    [value, unit].forEach((inp) =>
      inp.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') check.click();
      }),
    );
  };
  showStep(0);
}

function reveal(el: HTMLElement) {
  requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function prettyUnit(u: string): string {
  return u
    .replace(/\^-?\d+/g, (m) => sup(Number(m.slice(1))))
    .replace(/\*/g, '·');
}

/**
 * Übungsschrein: gelöste Aufgaben aller Level kehren nach dem Leitner-Prinzip zurück.
 * Fällige zuerst, sonst die mit der niedrigsten Box.
 */
export function openReview(levels: LevelData[], onFinish: () => void, count = 6): boolean {
  const all = levels.flatMap((l) => l.tasks).filter((t) => game.isTaskDone(t.id));
  if (!all.length) return false;
  const box = (id: string) => game.data.taskBoxes[id]?.box ?? 1;
  const due = all.filter((t) => game.taskDue(t.id));
  const rest = all.filter((t) => !game.taskDue(t.id)).sort((a, b) => box(a.id) - box(b.id));
  const shuffled = [...due.sort(() => Math.random() - 0.5), ...rest];
  const pick = shuffled.slice(0, count);
  const merged: LevelData = { ...levels[0], spells: levels.flatMap((l) => l.spells), tasks: all };
  const enc: Encounter = {
    id: 'review',
    marker: '',
    kind: 'crystal',
    name: due.length ? `Übungsschrein – ${due.length} fällig` : 'Übungsschrein – freies Üben',
    lesson: 0,
    intro: 'Der Schrein leuchtet auf. Aufgaben, die du schon einmal gelöst hast, erscheinen erneut – Werte und Einheiten musst du wieder selbst einsetzen.',
    outro: 'Wiederholungsrunde geschafft! Was sauber saß, kommt erst später wieder.',
    tasks: pick.map((t) => t.id),
  };
  openEncounter(merged, enc, () => onFinish(), 'review');
  return true;
}

/** Übung der Mentorin zu einer Lektion: ohne Risiko, mit Zwischenschritten und Gratis-Hilfen. */
export function openPractice(level: LevelData, lessonIndex: number, onFinish: (done: boolean) => void): boolean {
  const lesson = level.mentor.lessons[lessonIndex];
  const pool = level.practice ?? [];
  const ids = (lesson.practice ?? []).filter((id) => pool.some((t) => t.id === id));
  if (!ids.length) return false;
  const merged: LevelData = { ...level, tasks: [...level.tasks, ...pool] };
  const enc: Encounter = {
    id: `practice-${level.id}-${lessonIndex + 1}`,
    marker: '',
    kind: 'crystal',
    name: `🎓 Übung – ${lesson.title}`,
    lesson: 0,
    intro: `${level.mentor.name}: „Jetzt bist du dran! Wir rechnen gemeinsam – ich helfe dir, wo du hängst.“`,
    outro: `${level.mentor.name}: „Sehr gut! Genau so gehst du auch bei den Prüfsteinen vor.“`,
    tasks: ids,
  };
  openEncounter(merged, enc, onFinish, 'practice');
  return true;
}
