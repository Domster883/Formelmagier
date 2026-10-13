/**
 * Datenformat für Level, Zauber und Aufgaben.
 * Alle Lerninhalte liegen als JSON in src/content/levels/level-XX.json.
 */

export interface SpellVar {
  /** Variablenname in `expr` (ASCII) */
  symbol: string;
  /** Anzeige, z. B. "m" oder "x̄" */
  display: string;
  label: string;
  /** Einheit, deren Dimension erwartet wird ("*" = beliebig) */
  unit: string;
  /** Messreihe statt Einzelwert */
  list?: boolean;
}

export interface Spell {
  id: string;
  name: string;
  /** Anzeigeformel, z. B. "q = m / (A · t)" */
  formula: string;
  /** auswertbare Formel über die Variablen-Symbole */
  expr: string;
  description: string;
  vars: SpellVar[];
  result: { display: string; label: string; unit: string };
  manaCost: number;
}

export interface GivenValue {
  label: string;
  value: string;
  unit: string;
}

export interface CommonMistake {
  value: number;
  unit: string;
  feedback: string;
}

export interface TaskBase {
  id: string;
  title: string;
  topic: string;
  story: string;
  question: string;
  hints: [string, string, string];
  solutionSteps: string[];
  xp: number;
  gold: number;
}

export interface NumericTask extends TaskBase {
  type: 'numeric';
  given: GivenValue[];
  /** erlaubte Zauber (Spell-IDs) */
  spells: string[];
  answer: { value: number; unit: string };
  /** relative Toleranz, z. B. 0.01 für ±1 % */
  tolerance: number;
  /** Ergebnis muss in kohärenten SI-Einheiten (ohne Vorsilbe) angegeben werden */
  requireSI?: boolean;
  /** Musterlösung als Zauber mit eingesetzten Werten (wird automatisch geprüft) */
  solution: { spell: string; inputs: Record<string, string> };
  commonMistakes?: CommonMistake[];
}

export interface ChoiceTask extends TaskBase {
  type: 'choice';
  given?: GivenValue[];
  options: string[];
  correct: number;
  explanation: string;
}

export type Task = NumericTask | ChoiceTask;

export type EncounterKind = 'crystal' | 'monster' | 'boss';

export interface Encounter {
  id: string;
  /** Buchstabe auf der Karte */
  marker: string;
  kind: EncounterKind;
  name: string;
  /** Lektion der Mentorin, die vorher gehört werden muss (1-basiert) */
  lesson: number;
  intro: string;
  outro: string;
  tasks: string[];
  monster?: { name: string; hp: number; attack: number; color: string };
}

export interface Lesson {
  title: string;
  /** max. 5 Sätze */
  lines: string[];
  unlocks: string[];
}

export interface Flashcard {
  id: string;
  q: string;
  options: string[];
  correct: number;
  explain: string;
}

export interface LevelData {
  id: number;
  title: string;
  chapter: string;
  world: string;
  intro: string;
  mentor: { name: string; marker: string; greeting: string; lessons: Lesson[]; afterAll: string };
  merchant: { name: string; marker: string; greeting: string };
  /** Übungsschrein: Wiederholung bereits gelöster Aufgaben (Spaced Repetition) */
  shrine?: { name: string; marker: string; greeting: string };
  legend: Record<string, string>;
  map: string[];
  spells: Spell[];
  tasks: Task[];
  encounters: Encounter[];
  flashcards: Flashcard[];
  bossVictory: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  effect: string;
}
