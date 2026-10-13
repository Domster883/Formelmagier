/**
 * Lernkarten mit Spaced Repetition (Leitner-System).
 *  - "meditate": jederzeit, richtige Karten regenerieren Mana
 *  - "review":   Lernkarten-Runde nach dem Boss eines Levels
 */
import { LEVELS } from '../content/levels';
import type { Flashcard } from '../content/types';
import { game } from '../game/state';
import { h, openModal } from './dom';

const MANA_PER_CARD = 10;

function availableCards(levelId?: number): Flashcard[] {
  const levels = levelId ? LEVELS.filter((l) => l.id === levelId) : LEVELS.filter((l) => (game.data.lessons[l.id] ?? 0) > 0);
  return levels.flatMap((l) => l.flashcards);
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function openFlashcards(opts: { mode: 'meditate' | 'review'; levelId?: number; onDone?: () => void }) {
  const pool = availableCards(opts.levelId);
  const m = openModal({
    title: opts.mode === 'review' ? '📚 Lernkarten-Runde' : '🧘 Meditation – Lernkarten',
    onClose: opts.onDone,
  });
  if (!pool.length) {
    m.body.append(h('p', {}, 'Du hast noch keine Lernkarten. Höre zuerst eine Lektion bei der Mentorin.'));
    return;
  }
  game.data.cardRound++;
  // fällige Karten zuerst, dann nach Box (schwache zuerst)
  const due = shuffle(pool.filter((c) => game.cardDue(c.id)));
  const rest = shuffle(pool.filter((c) => !game.cardDue(c.id))).sort((a, b) => (game.data.cards[a.id]?.box ?? 1) - (game.data.cards[b.id]?.box ?? 1));
  const count = opts.mode === 'review' ? Math.min(pool.length, 8) : Math.min(pool.length, 5);
  const cards = [...due, ...rest].slice(0, count);

  let idx = 0;
  let right = 0;
  let manaGained = 0;

  const render = () => {
    m.body.innerHTML = '';
    if (idx >= cards.length) {
      game.save();
      game.emit();
      m.body.append(
        h('div', { class: 'victory' }, h('div', { class: 'big' }, `${right} / ${cards.length} richtig`), opts.mode === 'meditate' ? h('p', {}, `Du hast ${manaGained} Mana zurückgewonnen.`) : h('p', {}, 'Karten, die du falsch hattest, kommen bald wieder. Richtige wandern in eine höhere Box und tauchen seltener auf.')),
        h('div', { class: 'row end' }, h('button', { class: 'primary', autofocus: true, onclick: () => m.close() }, 'Fertig')),
      );
      (m.body.querySelector('button.primary') as HTMLElement)?.focus();
      return;
    }
    const card = cards[idx];
    const box = game.data.cards[card.id]?.box ?? 1;
    const fb = h('div', { class: 'feedback' });
    const opts_ = h('div', { class: 'choices' });
    let answered = false;
    card.options.forEach((o, i) => {
      const b = h('button', { class: 'choice' }, o);
      b.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const ok = i === card.correct;
        game.reviewCard(card.id, ok);
        b.classList.add(ok ? 'right' : 'wrong');
        (opts_.children[card.correct] as HTMLElement).classList.add('right');
        if (ok) {
          right++;
          if (opts.mode === 'meditate') {
            const before = game.data.mana;
            game.restoreMana(MANA_PER_CARD);
            manaGained += game.data.mana - before;
          }
        }
        game.emit();
        fb.className = `feedback ${ok ? 'good' : 'bad'}`;
        fb.append(h('strong', {}, ok ? '✓ Richtig' : '✗ Leider nicht'), h('p', {}, card.explain), h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: () => { idx++; render(); } }, 'Nächste Karte ▸')));
        (fb.querySelector('button') as HTMLElement).focus();
      });
      opts_.append(b);
    });
    m.body.append(
      h('div', { class: 'row' }, h('span', { class: 'small' }, `Karte ${idx + 1} / ${cards.length}`), h('span', { class: 'small' }, `Box ${box} / 5`), opts.mode === 'meditate' ? h('span', { class: 'small' }, `✦ ${game.data.mana} / ${game.maxMana}`) : null),
      h('p', { class: 'question' }, card.q),
      opts_,
      fb,
    );
  };
  render();
}
