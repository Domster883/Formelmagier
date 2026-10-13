/**
 * Spielstand: XP, Gold, Mana, Ausrüstung, Fortschritt, Statistik, Lernkarten.
 * Gespeichert in localStorage (abgesichert mit try/catch).
 */

const SAVE_KEY = 'formelmagier.save.v1';

export interface TopicStats {
  attempts: number;
  correct: number;
  unitErrors: number;
  magnitudeErrors: number;
  hintsUsed: number;
}

export interface CardState {
  /** Leitner-Box 1–5 */
  box: number;
  /** fällig ab Lernrunde Nr. */
  due: number;
}

export interface SaveData {
  version: 1;
  name: string;
  xp: number;
  gold: number;
  mana: number;
  hp: number;
  items: string[];
  learnedSpells: string[];
  /** gehörte Lektionen pro Level */
  lessons: Record<number, number>;
  /** Lektionen pro Level, deren Theorie schon gehört wurde (Übung evtl. noch offen) */
  theorySeen: Record<number, number>;
  /** einmal gelöste Übungsaufgaben (XP nur beim ersten Mal) */
  practiced: string[];
  completedTasks: string[];
  completedEncounters: string[];
  bossDefeated: number[];
  position: Record<number, { x: number; y: number }>;
  stats: Record<string, TopicStats>;
  cards: Record<string, CardState>;
  cardRound: number;
  /** Leitner-Boxen für gelöste Aufgaben (Wiederholung) */
  taskBoxes: Record<string, CardState>;
  taskRound: number;
  createdAt: number;
}

export const RANKS = [
  { name: 'Lehrling', xp: 0 },
  { name: 'Adept', xp: 400 },
  { name: 'Magier', xp: 1500 },
  { name: 'Erzmagier', xp: 4000 },
  { name: 'Großmeister der Elemente', xp: 8000 },
];

type Listener = () => void;

function freshSave(name: string): SaveData {
  return {
    version: 1,
    name,
    xp: 0,
    gold: 20,
    mana: 100,
    hp: 50,
    items: [],
    learnedSpells: [],
    lessons: {},
    theorySeen: {},
    practiced: [],
    completedTasks: [],
    completedEncounters: [],
    bossDefeated: [],
    position: {},
    stats: {},
    cards: {},
    cardRound: 0,
    taskBoxes: {},
    taskRound: 0,
    createdAt: Date.now(),
  };
}

class GameState {
  data: SaveData = freshSave('Lehrling');
  private listeners: Listener[] = [];
  private memoryFallback: string | null = null;

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  emit() {
    this.listeners.forEach((l) => l());
  }

  newGame(name: string) {
    this.data = freshSave(name.trim() || 'Lehrling');
    this.save();
    this.emit();
  }

  hasSave(): boolean {
    return this.readRaw() !== null;
  }

  private readRaw(): string | null {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch {
      return this.memoryFallback;
    }
  }

  load(): boolean {
    const raw = this.readRaw();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 1) return false;
      this.data = { ...freshSave(parsed.name), ...parsed };
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  save() {
    const raw = JSON.stringify(this.data);
    try {
      localStorage.setItem(SAVE_KEY, raw);
    } catch {
      this.memoryFallback = raw;
    }
  }

  deleteSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignorieren */
    }
    this.memoryFallback = null;
  }

  // --- abgeleitete Werte ---------------------------------------------------

  get rankIndex(): number {
    let r = 0;
    RANKS.forEach((rank, i) => {
      if (this.data.xp >= rank.xp) r = i;
    });
    return r;
  }
  get rank(): string {
    return RANKS[this.rankIndex].name;
  }
  get nextRankXp(): number | null {
    return RANKS[this.rankIndex + 1]?.xp ?? null;
  }
  get maxMana(): number {
    return 100 + 10 * this.rankIndex;
  }
  get maxHp(): number {
    return 50 + 10 * this.rankIndex;
  }
  has(item: string): boolean {
    return this.data.items.includes(item);
  }
  knows(spell: string): boolean {
    return this.data.learnedSpells.includes(spell);
  }
  isLevelUnlocked(id: number): boolean {
    return id === 1 || this.data.bossDefeated.includes(id - 1);
  }

  // --- Änderungen ----------------------------------------------------------

  /** gibt true zurück, wenn ein neuer Rang erreicht wurde */
  addXp(xp: number): boolean {
    const before = this.rankIndex;
    this.data.xp += Math.round(xp);
    const up = this.rankIndex > before;
    if (up) {
      this.data.mana = this.maxMana;
      this.data.hp = this.maxHp;
    }
    return up;
  }
  addGold(g: number) {
    this.data.gold += Math.round(g);
  }
  spendMana(n: number) {
    this.data.mana = Math.max(0, this.data.mana - n);
  }
  restoreMana(n: number) {
    this.data.mana = Math.min(this.maxMana, this.data.mana + n);
  }
  damage(n: number) {
    this.data.hp = Math.max(0, this.data.hp - n);
  }
  heal(n: number) {
    this.data.hp = Math.min(this.maxHp, this.data.hp + n);
  }
  learn(spells: string[]) {
    for (const s of spells) if (!this.knows(s)) this.data.learnedSpells.push(s);
  }
  completeTask(id: string) {
    if (!this.data.completedTasks.includes(id)) this.data.completedTasks.push(id);
  }
  isTaskDone(id: string) {
    return this.data.completedTasks.includes(id);
  }
  completeEncounter(id: string) {
    if (!this.data.completedEncounters.includes(id)) this.data.completedEncounters.push(id);
  }
  isEncounterDone(id: string) {
    return this.data.completedEncounters.includes(id);
  }

  stat(topic: string): TopicStats {
    return (this.data.stats[topic] ??= { attempts: 0, correct: 0, unitErrors: 0, magnitudeErrors: 0, hintsUsed: 0 });
  }

  /** Leitner-System: richtige Karten wandern eine Box höher und kommen später wieder */
  reviewCard(id: string, correct: boolean) {
    const c = (this.data.cards[id] ??= { box: 1, due: 0 });
    c.box = correct ? Math.min(5, c.box + 1) : 1;
    c.due = this.data.cardRound + [0, 1, 2, 4, 8, 16][c.box];
  }
  /**
   * Aufgaben-Wiederholung: sauber gelöst (ohne Fehlversuch, ohne Hilfe) -> Box höher,
   * sonst zurück in Box 1. Fällig nach 1, 2, 4, 8, 16 Wiederholungsrunden.
   */
  reviewTask(id: string, clean: boolean) {
    const c = (this.data.taskBoxes[id] ??= { box: 1, due: 0 });
    c.box = clean ? Math.min(5, c.box + 1) : 1;
    c.due = this.data.taskRound + [0, 1, 2, 4, 8, 16][c.box];
  }
  taskDue(id: string): boolean {
    const c = this.data.taskBoxes[id];
    return !!c && c.due <= this.data.taskRound;
  }
  dueTaskCount(): number {
    return Object.keys(this.data.taskBoxes).filter((id) => this.taskDue(id)).length;
  }
  advanceTaskRound() {
    this.data.taskRound++;
  }

  cardDue(id: string): boolean {
    const c = this.data.cards[id];
    return !c || c.due <= this.data.cardRound;
  }
}

export const game = new GameState();
