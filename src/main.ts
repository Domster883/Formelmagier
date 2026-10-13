import Phaser from 'phaser';
import './style.css';
import { LEVEL_OVERVIEW, getLevel } from './content/levels';
import type { LevelData } from './content/types';
import { LevelScene, type EntityRef } from './game/LevelScene';
import { game } from './game/state';
import { closeAllModals, closeTopModal, h, isModalOpen, openModal, showDialog, toast } from './ui/dom';
import { openEncounter } from './ui/encounter';
import { openFlashcards } from './ui/flashcards';
import { openGrimoire, openShop, openStats, talkToMentor } from './ui/menus';

const screen = document.getElementById('screen')!;
const hud = document.getElementById('hud')!;
const statusEl = document.getElementById('status')!;

let phaser: Phaser.Game | null = null;
let currentLevel: LevelData | null = null;

function scene(): LevelScene | null {
  return (phaser?.scene.getScene('level') as LevelScene) ?? null;
}

function ensurePhaser(): Phaser.Game {
  if (phaser) return phaser;
  phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 576,
    pixelArt: true,
    backgroundColor: '#1a1626',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    banner: false,
  });
  phaser.scene.add('level', LevelScene, false);
  return phaser;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function renderHud() {
  if (!currentLevel) return;
  const d = game.data;
  const next = game.nextRankXp;
  const prev = [0, 400, 1500, 4000, 8000][game.rankIndex];
  const xpPct = next ? ((d.xp - prev) / (next - prev)) * 100 : 100;
  hud.innerHTML = '';
  hud.append(
    h('div', { class: 'hud-who' }, h('b', {}, d.name), h('span', { class: 'rank' }, game.rank), h('div', { class: 'bar xpbar', title: `${d.xp} XP` }, h('div', { class: 'fill', style: `width:${xpPct}%` }), h('span', {}, `${d.xp}${next ? ' / ' + next : ''} XP`))),
    h('div', { class: 'hud-bars' }, bar('❤', d.hp, game.maxHp, 'hpbar'), bar('✦', d.mana, game.maxMana, 'manabar'), h('span', { class: 'gold' }, `🪙 ${d.gold}`)),
    h(
      'div',
      { class: 'hud-buttons' },
      h('button', { onclick: openGrimoire, title: 'Grimoire (G)' }, '📖', h('span', {}, ' Grimoire')),
      h('button', { onclick: () => openFlashcards({ mode: 'meditate' }), title: 'Meditieren: Lernkarten für Mana (L)' }, '🧘', h('span', {}, ' Meditieren')),
      h('button', { onclick: openStats, title: 'Statistik (T)' }, '📊', h('span', {}, ' Statistik')),
      h('button', { onclick: () => showWorld(), title: 'Weltkarte (M)' }, '🗺', h('span', {}, ' Welt')),
    ),
  );
}

function bar(icon: string, v: number, max: number, cls: string) {
  return h('div', { class: `bar ${cls}`, title: `${v} / ${max}` }, h('div', { class: 'fill', style: `width:${(v / max) * 100}%` }), h('span', {}, `${icon} ${v} / ${max}`));
}

game.onChange(renderHud);

// ---------------------------------------------------------------------------
// Titel & Weltkarte
// ---------------------------------------------------------------------------

function showTitle() {
  currentLevel = null;
  closeAllModals();
  hud.classList.add('hidden');
  statusEl.textContent = '';
  screen.classList.remove('hidden');
  screen.innerHTML = '';
  const hasSave = game.hasSave();
  const name = h('input', { type: 'text', placeholder: 'Name deines Zauberlehrlings', maxlength: 24, value: '' });
  const start = () => {
    if (hasSave && !confirm('Neues Spiel beginnen? Der alte Spielstand wird überschrieben.')) return;
    game.newGame(name.value);
    showWorld();
  };
  name.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') start();
  });
  screen.append(
    h(
      'div',
      { class: 'title-card' },
      h('div', { class: 'logo' }, h('span', {}, '⚗'), ' Formelmagier'),
      h('p', { class: 'tagline' }, 'Ein Physik-Rollenspiel: Formeln sind deine Zaubersprüche, Einheiten deine Magie.'),
      hasSave
        ? h('button', { class: 'primary big', autofocus: true, onclick: () => { game.load(); showWorld(); } }, `▶ Weiterspielen (${loadName()})`)
        : null,
      h('div', { class: 'new-game' }, name, h('button', { class: hasSave ? 'ghost' : 'primary', onclick: start }, '✦ Neues Spiel')),
      h(
        'details',
        { class: 'howto' },
        h('summary', {}, 'Wie spielt man?'),
        h(
          'ul',
          {},
          h('li', {}, 'Bewegen: Pfeiltasten / WASD – oder auf die Karte klicken.'),
          h('li', {}, 'Interagieren: E, Leertaste oder Enter (oder die Figur anklicken).'),
          h('li', {}, 'Mentorin zuerst! Sie bringt dir Theorie und neue Zauber bei.'),
          h('li', {}, 'Zaubern: Zauber wählen → Werte MIT Einheit einsetzen → Ergebnis mit Einheit angeben.'),
          h('li', {}, 'Falsche Dimension → der Zauber verpufft. Falsche Zehnerpotenz → er trifft nur schwach.'),
          h('li', {}, 'Dezimalkomma ist erlaubt: 2,39 oder 2.39; Zehnerpotenzen als 2,39e-4 oder 2,39·10^-4.'),
          h('li', {}, 'Mana leer? Meditieren = Lernkarten beantworten.'),
          h('li', {}, 'Esc schließt Fenster. G = Grimoire, L = Meditieren, T = Statistik, M = Weltkarte.'),
        ),
      ),
      h('p', { class: 'small credit' }, 'Inhalte nach der Kapitelstruktur der Lehrveranstaltung „Physik“ (UBRM, BOKU Wien) – Texte und Aufgaben in eigenen Worten.'),
    ),
  );
  setTimeout(() => (hasSave ? (screen.querySelector('button.primary') as HTMLElement) : name).focus(), 50);
}

function loadName(): string {
  try {
    const raw = localStorage.getItem('formelmagier.save.v1');
    return raw ? (JSON.parse(raw).name as string) : '';
  } catch {
    return '';
  }
}

function showWorld() {
  game.save();
  currentLevel = null;
  closeAllModals();
  if (phaser?.scene.isActive('level')) phaser.scene.stop('level');
  hud.classList.add('hidden');
  statusEl.textContent = '';
  screen.classList.remove('hidden');
  screen.innerHTML = '';
  const grid = h('div', { class: 'world-grid' });
  for (const o of LEVEL_OVERVIEW) {
    const data = getLevel(o.id);
    const unlocked = game.isLevelUnlocked(o.id);
    const done = game.data.bossDefeated.includes(o.id);
    const playable = unlocked && !!data;
    const state = done ? '✔ gemeistert' : !unlocked ? '🔒 versiegelt' : !data ? '🛠 in Arbeit' : '▶ offen';
    const card = h(
      'button',
      { class: `world-card ${playable ? 'open' : 'locked'} ${done ? 'done' : ''}`, disabled: !playable, onclick: () => data && startLevel(data) },
      h('div', { class: 'num' }, String(o.id)),
      h('div', { class: 'wname' }, o.world),
      h('div', { class: 'small' }, o.chapter),
      h('div', { class: 'small boss' }, `Boss: ${o.boss}`),
      h('div', { class: 'state' }, state),
    );
    grid.append(card);
  }
  screen.append(
    h(
      'div',
      { class: 'world' },
      h('div', { class: 'row' }, h('h1', {}, '🗺 Die Welt der Formeln'), h('span', { class: 'grow' }), h('span', {}, `${game.data.name} · ${game.rank} · ${game.data.xp} XP · 🪙 ${game.data.gold}`)),
      h('p', { class: 'small' }, 'Jede Region entspricht einem Kapitel. Besiege den Boss, um die nächste Region freizuschalten. Bereits gemeisterte Regionen kannst du jederzeit zum Training erneut betreten.'),
      grid,
      h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: openStats }, '📊 Statistik'), h('button', { class: 'ghost', onclick: openGrimoire }, '📖 Grimoire'), h('span', { class: 'grow' }), h('button', { class: 'ghost', onclick: showTitle }, '⏏ Titelbildschirm')),
    ),
  );
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

function startLevel(level: LevelData) {
  currentLevel = level;
  screen.classList.add('hidden');
  hud.classList.remove('hidden');
  renderHud();
  const p = ensurePhaser();
  const run = () => {
    if (p.scene.isActive('level')) p.scene.stop('level');
    p.scene.start('level', { level });
  };
  if (p.isBooted) run();
  else p.events.once('ready', run);
  if (!(game.data.lessons[level.id] > 0)) {
    showDialog(level.world, [level.intro], { title: `Level ${level.id} – ${level.title}` });
  }
}

LevelScene.hooks = {
  status: (t) => (statusEl.textContent = t || 'Pfeiltasten/WASD oder Klick: bewegen · E: interagieren · G: Grimoire · L: Meditieren'),
  interact: (ref: EntityRef) => {
    const level = currentLevel;
    if (!level || isModalOpen()) return;
    const refresh = () => scene()?.refreshMarkers();
    switch (ref.type) {
      case 'mentor':
        talkToMentor(level, refresh);
        break;
      case 'merchant':
        openShop(level);
        break;
      case 'gate': {
        const total = level.encounters.filter((e) => e.kind !== 'boss');
        const done = total.filter((e) => game.isEncounterDone(e.id)).length;
        showDialog('Versiegeltes Tor', [`Ein schweres Gitter versperrt den Prüfungssaal. Darauf steht: „Nur wer alle Prüfsteine der Akademie gemeistert hat, darf eintreten.“ (${done} / ${total.length} geschafft)`]);
        break;
      }
      case 'encounter': {
        const enc = ref.encounter;
        const heard = game.data.lessons[level.id] ?? 0;
        if (heard < enc.lesson) {
          const lesson = level.mentor.lessons[enc.lesson - 1];
          showDialog(enc.name, [`${enc.intro}`, `Dafür fehlt dir noch das Wissen aus „${lesson.title}“. Sprich mit ${level.mentor.name}!`]);
          return;
        }
        const firstWin = !game.isEncounterDone(enc.id);
        openEncounter(level, enc, (won) => {
          refresh();
          renderHud();
          if (won && firstWin && enc.kind === 'boss') levelComplete(level);
          else if (won && firstWin && scene()?.gateOpen() && enc.kind !== 'boss') {
            const boss = level.encounters.find((e) => e.kind === 'boss');
            if (boss && !game.isEncounterDone(boss.id)) toast('Ein Grollen… Das Tor zum Prüfungssaal hat sich geöffnet!', 'gold', 4500);
          }
        });
        break;
      }
    }
  },
};

function levelComplete(level: LevelData) {
  showDialog(level.mentor.name, [level.bossVictory, 'Bevor du weiterziehst: Festige dein Wissen in einer Lernkarten-Runde!'], {
    title: '🏆 Level geschafft!',
    portrait: 'mentor',
    onDone: () =>
      openFlashcards({
        mode: 'review',
        levelId: level.id,
        onDone: () => {
          const m = openModal({ title: `🏆 ${level.world} gemeistert` });
          const stats = Object.entries(game.data.stats);
          m.body.append(
            h('p', {}, `Rang: ${game.rank} · ${game.data.xp} XP · 🪙 ${game.data.gold}`),
            h('ul', {}, ...stats.map(([t, s]) => h('li', {}, `${t}: ${s.correct} / ${s.attempts} Versuche richtig, ${s.unitErrors} Einheitenfehler`))),
            h('p', { class: 'small' }, getLevel(level.id + 1) ? 'Die nächste Region ist freigeschaltet!' : 'Level 2 (Windpfade) ist freigeschaltet, wird aber gerade noch gebaut. Level 1 kannst du jederzeit zum Training wiederholen.'),
            h('div', { class: 'row end' }, h('button', { class: 'ghost', onclick: () => m.close() }, 'Hier bleiben'), h('button', { class: 'primary', autofocus: true, onclick: () => showWorld() }, 'Zur Weltkarte')),
          );
        },
      }),
  });
}

// ---------------------------------------------------------------------------
// Tastatur
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (closeTopModal()) e.preventDefault();
    return;
  }
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || isModalOpen() || !currentLevel) return;
  const k = e.key.toLowerCase();
  if (k === 'g') openGrimoire();
  else if (k === 'l') openFlashcards({ mode: 'meditate' });
  else if (k === 't') openStats();
  else if (k === 'm') showWorld();
});

window.addEventListener('beforeunload', () => game.save());

statusEl.textContent = '';
showTitle();
