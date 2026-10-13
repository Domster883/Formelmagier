import type { Item, LevelData } from './types';
import itemsJson from './items.json';
import constantsJson from './constants.json';

const modules = import.meta.glob<{ default: LevelData }>('./levels/level-*.json', { eager: true });

export const LEVELS: LevelData[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id - b.id);

export const ITEMS: Item[] = itemsJson as Item[];
export const CONSTANTS: { symbol: string; name: string; value: string; unit: string }[] = constantsJson;

/** Überblick über alle 10 Level (Kapitelstruktur), auch wenn noch nicht gebaut */
export const LEVEL_OVERVIEW = [
  { id: 1, world: 'Akademie der Maße', chapter: 'Kap. 1 Einleitung', boss: 'Messfehler-Golem' },
  { id: 2, world: 'Windpfade', chapter: 'Kap. 2 Kinematik', boss: 'Der rasende Wirbelgeist' },
  { id: 3, world: 'Schmiede der Kräfte', chapter: 'Kap. 3 Kraft', boss: 'Der Tiefsee-Kraken' },
  { id: 4, world: 'Turm der Hebel', chapter: 'Kap. 4 Drehmoment', boss: 'Der kippende Riese' },
  { id: 5, world: 'Minen von Joule', chapter: 'Kap. 5 Arbeit, Energie, Leistung', boss: 'Der Energievampir' },
  { id: 6, world: 'Tal der Kraftwerke', chapter: 'Kap. 6 Energieeinsatz & -gewinnung', boss: 'Der Blackout-Drache' },
  { id: 7, world: 'Gewitterzitadelle', chapter: 'Kap. 7 Elektrizität & Magnetismus', boss: 'Der Kurzschluss-Dämon' },
  { id: 8, world: 'Feuerberge', chapter: 'Kap. 8 Wärmeenergie', boss: 'Der Salamander-Fürst' },
  { id: 9, world: 'Nebelsümpfe', chapter: 'Kap. 9 + 11 Aggregatzustände, Wärmetransport', boss: 'Die Nebelhexe' },
  { id: 10, world: 'Das Carnot-Heiligtum', chapter: 'Kap. 10 Wärmekraftmaschinen', boss: 'Der Ewige Motor' },
];

export function getLevel(id: number): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}
