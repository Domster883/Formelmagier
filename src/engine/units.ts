/**
 * Einheiten-Engine ("Einheiten-Magie").
 *
 * Jede Einheit wird auf einen SI-Faktor und einen Dimensionsvektor über den
 * 7 SI-Basiseinheiten (m, kg, s, A, K, mol, cd) abgebildet.
 *   "km/h"  -> factor 1000/3600, dims m¹·s⁻¹
 *   "kWh"   -> factor 3.6e6,     dims kg·m²·s⁻²
 */

export const BASE_UNITS = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];
export type Dims = [number, number, number, number, number, number, number];

export interface UnitValue {
  /** Multiplikator in SI-Basiseinheiten */
  factor: number;
  dims: Dims;
}

export interface Quantity {
  /** Wert in SI-Basiseinheiten */
  value: number;
  dims: Dims;
}

export class UnitError extends Error {}

export const DIMLESS: Dims = [0, 0, 0, 0, 0, 0, 0];

function d(spec: Partial<Record<BaseUnit, number>>): Dims {
  return BASE_UNITS.map((b) => spec[b] ?? 0) as Dims;
}

export function mulDims(a: Dims, b: Dims): Dims {
  return a.map((x, i) => x + b[i]) as Dims;
}
export function divDims(a: Dims, b: Dims): Dims {
  return a.map((x, i) => x - b[i]) as Dims;
}
export function powDims(a: Dims, p: number): Dims {
  return a.map((x) => roundExp(x * p)) as Dims;
}
export function dimsEqual(a: Dims, b: Dims): boolean {
  return a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
}
export function isDimless(a: Dims): boolean {
  return dimsEqual(a, DIMLESS);
}
function roundExp(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

// ---------------------------------------------------------------------------
// Einheitentabelle
// ---------------------------------------------------------------------------

interface UnitDef extends UnitValue {
  /** darf eine Vorsilbe tragen (k, M, m, µ, …) */
  prefixable: boolean;
  name: string;
}

const LEN = d({ m: 1 });
const MASS = d({ kg: 1 });
const TIME = d({ s: 1 });
const FORCE = d({ kg: 1, m: 1, s: -2 });
const ENERGY = d({ kg: 1, m: 2, s: -2 });
const POWER = d({ kg: 1, m: 2, s: -3 });
const PRESSURE = d({ kg: 1, m: -1, s: -2 });
const CHARGE = d({ A: 1, s: 1 });
const VOLTAGE = d({ kg: 1, m: 2, s: -3, A: -1 });

const U: Record<string, UnitDef> = {};
function def(symbols: string[], factor: number, dims: Dims, prefixable: boolean, name: string) {
  for (const s of symbols) U[s] = { factor, dims, prefixable, name };
}

// 7 SI-Basiseinheiten (kg wird über g + Vorsilbe k gebildet)
def(['m'], 1, LEN, true, 'Meter');
def(['g'], 1e-3, MASS, true, 'Gramm');
def(['s', 'sec'], 1, TIME, true, 'Sekunde');
def(['A'], 1, d({ A: 1 }), true, 'Ampere');
def(['K'], 1, d({ K: 1 }), true, 'Kelvin');
def(['mol'], 1, d({ mol: 1 }), true, 'Mol');
def(['cd'], 1, d({ cd: 1 }), true, 'Candela');

// abgeleitete SI-Einheiten
def(['Hz'], 1, d({ s: -1 }), true, 'Hertz');
def(['N'], 1, FORCE, true, 'Newton');
def(['Pa'], 1, PRESSURE, true, 'Pascal');
def(['J'], 1, ENERGY, true, 'Joule');
def(['W'], 1, POWER, true, 'Watt');
def(['C'], 1, CHARGE, true, 'Coulomb');
def(['V'], 1, VOLTAGE, true, 'Volt');
def(['Ω', 'Ohm', 'ohm'], 1, d({ kg: 1, m: 2, s: -3, A: -2 }), true, 'Ohm');
def(['S'], 1, d({ kg: -1, m: -2, s: 3, A: 2 }), true, 'Siemens');
def(['F'], 1, d({ kg: -1, m: -2, s: 4, A: 2 }), true, 'Farad');
def(['Wb'], 1, d({ kg: 1, m: 2, s: -2, A: -1 }), true, 'Weber');
def(['T'], 1, d({ kg: 1, s: -2, A: -1 }), true, 'Tesla');
def(['H'], 1, d({ kg: 1, m: 2, s: -2, A: -2 }), true, 'Henry');
def(['lm'], 1, d({ cd: 1 }), true, 'Lumen');
def(['lx'], 1, d({ cd: 1, m: -2 }), true, 'Lux');
def(['rad'], 1, DIMLESS, true, 'Radiant');
def(['sr'], 1, DIMLESS, false, 'Steradiant');

// gebräuchliche Nicht-SI-Einheiten
def(['min'], 60, TIME, false, 'Minute');
def(['h'], 3600, TIME, false, 'Stunde');
def(['d', 'Tag', 'Tage'], 86400, TIME, false, 'Tag');
def(['a', 'Jahr', 'Jahre', 'yr'], 365 * 86400, TIME, false, 'Jahr (365 d)');
def(['L', 'l'], 1e-3, d({ m: 3 }), true, 'Liter');
def(['t'], 1000, MASS, true, 'Tonne');
def(['ha'], 1e4, d({ m: 2 }), false, 'Hektar');
def(['bar'], 1e5, PRESSURE, true, 'Bar');
def(['atm'], 101325, PRESSURE, false, 'physikalische Atmosphäre');
def(['mmHg', 'Torr'], 133.322, PRESSURE, false, 'Millimeter Quecksilbersäule');
def(['kp'], 9.81, FORCE, false, 'Kilopond');
def(['kpm'], 9.81, ENERGY, false, 'Kilopondmeter');
def(['cal'], 4.1868, ENERGY, true, 'Kalorie');
def(['Wh'], 3600, ENERGY, true, 'Wattstunde');
def(['eV'], 1.602176634e-19, ENERGY, true, 'Elektronvolt');
def(['u'], 1.66053906660e-27, MASS, false, 'atomare Masseneinheit');
def(['°', 'deg'], Math.PI / 180, DIMLESS, false, 'Grad (Winkel)');
def(['°C'], 1, d({ K: 1 }), false, 'Grad Celsius (als Temperaturdifferenz)');
def(['U/min', 'rpm'], 1 / 60, d({ s: -1 }), false, 'Umdrehungen pro Minute');
def(['%'], 0.01, DIMLESS, false, 'Prozent');

export const PREFIXES: Record<string, { factor: number; name: string }> = {
  T: { factor: 1e12, name: 'Tera' },
  G: { factor: 1e9, name: 'Giga' },
  M: { factor: 1e6, name: 'Mega' },
  k: { factor: 1e3, name: 'Kilo' },
  h: { factor: 1e2, name: 'Hekto' },
  d: { factor: 1e-1, name: 'Dezi' },
  c: { factor: 1e-2, name: 'Zenti' },
  m: { factor: 1e-3, name: 'Milli' },
  µ: { factor: 1e-6, name: 'Mikro' },
  μ: { factor: 1e-6, name: 'Mikro' },
  u: { factor: 1e-6, name: 'Mikro' },
  n: { factor: 1e-9, name: 'Nano' },
  p: { factor: 1e-12, name: 'Piko' },
};

/** Vorsilben für die Anzeige (Zauberstab der Vorsilben) */
export const PREFIX_TABLE: { symbol: string; name: string; exp: number }[] = [
  { symbol: 'G', name: 'Giga', exp: 9 },
  { symbol: 'M', name: 'Mega', exp: 6 },
  { symbol: 'k', name: 'Kilo', exp: 3 },
  { symbol: 'h', name: 'Hekto', exp: 2 },
  { symbol: 'd', name: 'Dezi', exp: -1 },
  { symbol: 'c', name: 'Zenti', exp: -2 },
  { symbol: 'm', name: 'Milli', exp: -3 },
  { symbol: 'µ', name: 'Mikro', exp: -6 },
  { symbol: 'n', name: 'Nano', exp: -9 },
  { symbol: 'p', name: 'Piko', exp: -12 },
];

function lookupSymbol(sym: string): UnitValue {
  const direct = U[sym];
  if (direct) return direct;
  {
    const len = 1;
    const p = sym.slice(0, len);
    const rest = sym.slice(len);
    const pre = PREFIXES[p];
    const base = U[rest];
    if (pre && base && base.prefixable) {
      return { factor: pre.factor * base.factor, dims: base.dims };
    }
  }
  throw new UnitError(`Unbekannte Einheit „${sym}“`);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

function normalizeSuperscripts(s: string): string {
  return s.replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT[c]).join(''));
}

type Tok =
  | { t: 'id'; v: string }
  | { t: 'num'; v: number }
  | { t: 'op'; v: '*' | '/' | '^' | '(' | ')' };

const ID_CHAR = /[A-Za-zµμΩ°%]/;

function tokenizeUnit(input: string): Tok[] {
  let s = normalizeSuperscripts(input.trim())
    .replace(/[·⋅×∙•]/g, '*')
    .replace(/−/g, '-')
    .replace(/U\/min/g, 'rpm');
  // "N.m" -> "N*m" (Punkt zwischen Einheiten als Multiplikation)
  s = s.replace(/([A-Za-zµμΩ°)])\.(?=[A-Za-zµμΩ°(])/g, '$1*');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (ID_CHAR.test(c)) {
      let j = i;
      while (j < s.length && ID_CHAR.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      // direkt angehängter Exponent wie "m2" oder "s-1"
      const m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
      if (m) {
        toks.push({ t: 'op', v: '^' });
        toks.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
      }
      continue;
    }
    if (/[0-9]/.test(c) || ((c === '-' || c === '+') && toks.length > 0 && toks[toks.length - 1].v === '^')) {
      const m = /^[+-]?\d+([.,]\d+)?/.exec(s.slice(i));
      if (!m) throw new UnitError(`Unerwartetes Zeichen „${c}“`);
      toks.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')) });
      i += m[0].length;
      continue;
    }
    if (c === '*' || c === '/' || c === '^' || c === '(' || c === ')') {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '[' || c === ']') {
      i++;
      continue;
    }
    throw new UnitError(`Unerwartetes Zeichen „${c}“ in der Einheit`);
  }
  return toks;
}

/**
 * Grammatik (Physik-Konvention): alles nach einem "/" steht im Nenner,
 * also "kg/m²·s" == "kg/(m²·s)".
 *   expr    := product ('/' product)*
 *   product := power (('*')? power)*
 *   power   := primary ('^' number)?
 *   primary := id | number | '(' expr ')'
 */
class UnitParser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  parse(): UnitValue {
    if (this.toks.length === 0) return { factor: 1, dims: [...DIMLESS] as Dims };
    const v = this.expr();
    if (this.pos < this.toks.length) throw new UnitError('Einheit konnte nicht vollständig gelesen werden');
    return v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }

  private expr(): UnitValue {
    let num = this.product();
    let den: UnitValue = { factor: 1, dims: [...DIMLESS] as Dims };
    while (this.peek()?.t === 'op' && this.peek()!.v === '/') {
      this.pos++;
      const p = this.product();
      den = { factor: den.factor * p.factor, dims: mulDims(den.dims, p.dims) };
    }
    return { factor: num.factor / den.factor, dims: divDims(num.dims, den.dims) };
  }

  private product(): UnitValue {
    let acc = this.power();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'op' && t.v === '*') {
        this.pos++;
      } else if (!(t.t === 'id' || t.t === 'num' || (t.t === 'op' && t.v === '('))) {
        break;
      }
      const p = this.power();
      acc = { factor: acc.factor * p.factor, dims: mulDims(acc.dims, p.dims) };
    }
    return acc;
  }

  private power(): UnitValue {
    const base = this.primary();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '^') {
      this.pos++;
      let exp: number;
      const n = this.peek();
      if (n?.t === 'num') {
        exp = n.v;
        this.pos++;
      } else if (n?.t === 'op' && n.v === '(') {
        // ^(-2)
        this.pos++;
        const inner = this.peek();
        if (inner?.t !== 'num') throw new UnitError('Exponent erwartet');
        exp = inner.v;
        this.pos++;
        const close = this.peek();
        if (!(close?.t === 'op' && close.v === ')')) throw new UnitError('„)“ fehlt');
        this.pos++;
      } else {
        throw new UnitError('Exponent erwartet');
      }
      return { factor: Math.pow(base.factor, exp), dims: powDims(base.dims, exp) };
    }
    return base;
  }

  private primary(): UnitValue {
    const t = this.peek();
    if (!t) throw new UnitError('Einheit unvollständig');
    if (t.t === 'id') {
      this.pos++;
      return lookupSymbol(t.v);
    }
    if (t.t === 'num') {
      this.pos++;
      return { factor: t.v, dims: [...DIMLESS] as Dims };
    }
    if (t.v === '(') {
      this.pos++;
      const v = this.expr();
      const c = this.peek();
      if (!(c?.t === 'op' && c.v === ')')) throw new UnitError('„)“ fehlt');
      this.pos++;
      return v;
    }
    throw new UnitError(`Unerwartetes „${t.v}“`);
  }
}

export function parseUnit(input: string): UnitValue {
  const s = input.trim();
  if (s === '' || s === '1' || s === '-' || s === '–') return { factor: 1, dims: [...DIMLESS] as Dims };
  if (U[s]) return { factor: U[s].factor, dims: U[s].dims };
  return new UnitParser(tokenizeUnit(s)).parse();
}

/** Prüft, ob eine Einheit kohärent SI ist (Faktor 1, z. B. kg/(m²·s), N, J). */
export function isCoherentSI(input: string): boolean {
  const u = parseUnit(input);
  return Math.abs(u.factor - 1) < 1e-12;
}

// ---------------------------------------------------------------------------
// Zahlen (Dezimalkomma, Zehnerpotenzen)
// ---------------------------------------------------------------------------

/**
 * Liest Zahlen wie "2,39", "2.39", "2,39e-4", "2,39·10^-4", "2,39 × 10⁻⁴", "10^5".
 * Gibt NaN zurück, wenn die Eingabe keine Zahl ist.
 */
export function parseNumber(input: string): number {
  let s = normalizeSuperscripts(input.trim())
    .replace(/−/g, '-')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  if (s === '') return NaN;
  s = s.replace(/^([+-]?)10\^\(?([+-]?\d+)\)?$/, '$11e$2');
  s = s.replace(/[·⋅×∙*xX]10\^\(?([+-]?\d+)\)?$/, 'e$1');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return NaN;
  return parseFloat(s);
}

/** Liest eine Liste von Messwerten, getrennt durch ";" oder Leerzeichen. */
export function parseNumberList(input: string): number[] {
  const parts = input
    .split(/[;\s|]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.map(parseNumber);
}

export function toQuantity(value: number, unit: string): Quantity {
  const u = parseUnit(unit);
  return { value: value * u.factor, dims: u.dims };
}

/** "2,39 kg/m³" -> Quantity (Zahl und Einheit in einem String) */
export function parseQuantity(input: string): Quantity {
  const s = input.trim();
  const m = /^([+\-−]?[\d.,]+(?:\s*(?:[eE][+\-−]?\d+|[·⋅×∙*]\s*10\s*\^?\s*\(?[+\-−]?\d+\)?|[·⋅×∙*]\s*10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))?)\s*(.*)$/.exec(s);
  if (!m) throw new UnitError(`„${input}“ ist keine physikalische Größe`);
  const v = parseNumber(m[1]);
  if (Number.isNaN(v)) throw new UnitError(`„${m[1]}“ ist keine Zahl`);
  return toQuantity(v, m[2]);
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

const SUP_OUT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·',
};
export function sup(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP_OUT[c] ?? c)
    .join('');
}

const DISPLAY_ORDER: BaseUnit[] = ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'];

/** Dimensionsvektor als Produkt der SI-Basiseinheiten, z. B. "kg·m⁻²·s⁻¹" */
export function formatDims(dims: Dims): string {
  const parts: string[] = [];
  for (const b of DISPLAY_ORDER) {
    const e = dims[BASE_UNITS.indexOf(b)];
    if (Math.abs(e) < 1e-9) continue;
    parts.push(e === 1 ? b : b + sup(e));
  }
  return parts.length ? parts.join('·') : '1 (dimensionslos)';
}

const NAMED_DIMS: { dims: Dims; name: string; unit?: string }[] = [
  { dims: d({ m: 1 }), name: 'Länge', unit: 'm' },
  { dims: d({ kg: 1 }), name: 'Masse', unit: 'kg' },
  { dims: d({ s: 1 }), name: 'Zeit', unit: 's' },
  { dims: d({ A: 1 }), name: 'Stromstärke', unit: 'A' },
  { dims: d({ K: 1 }), name: 'Temperatur', unit: 'K' },
  { dims: d({ mol: 1 }), name: 'Stoffmenge', unit: 'mol' },
  { dims: d({ cd: 1 }), name: 'Lichtstärke', unit: 'cd' },
  { dims: d({ m: 2 }), name: 'Fläche', unit: 'm²' },
  { dims: d({ m: 3 }), name: 'Volumen', unit: 'm³' },
  { dims: d({ m: 1, s: -1 }), name: 'Geschwindigkeit', unit: 'm/s' },
  { dims: d({ m: 1, s: -2 }), name: 'Beschleunigung', unit: 'm/s²' },
  { dims: d({ s: -1 }), name: 'Frequenz / Rate', unit: 'Hz = 1/s' },
  { dims: FORCE, name: 'Kraft', unit: 'N' },
  { dims: ENERGY, name: 'Energie / Arbeit', unit: 'J' },
  { dims: POWER, name: 'Leistung', unit: 'W' },
  { dims: PRESSURE, name: 'Druck', unit: 'Pa' },
  { dims: d({ kg: 1, m: -3 }), name: 'Dichte', unit: 'kg/m³' },
  { dims: d({ kg: 1, s: -1 }), name: 'Massenstrom', unit: 'kg/s' },
  { dims: d({ kg: 1, m: -2, s: -1 }), name: 'Massenstromdichte', unit: 'kg/(m²·s)' },
  { dims: d({ kg: 1, m: 1, s: -1 }), name: 'Impuls', unit: 'kg·m/s' },
  { dims: CHARGE, name: 'Ladung', unit: 'C' },
  { dims: VOLTAGE, name: 'Spannung', unit: 'V' },
  { dims: DIMLESS, name: 'dimensionslose Größe', unit: '1' },
];

export function dimName(dims: Dims): string | undefined {
  return NAMED_DIMS.find((n) => dimsEqual(n.dims, dims))?.name;
}

export function describeDims(dims: Dims): string {
  const n = dimName(dims);
  return n ? `${n} [${formatDims(dims)}]` : `[${formatDims(dims)}]`;
}

const BASE_QTY: Record<BaseUnit, string> = {
  m: 'eine Länge',
  kg: 'eine Masse',
  s: 'eine Zeit',
  A: 'eine Stromstärke',
  K: 'eine Temperatur',
  mol: 'eine Stoffmenge',
  cd: 'eine Lichtstärke',
};

/**
 * Erklärt, warum zwei Dimensionen nicht zusammenpassen
 * ("Es fehlt s⁻¹ – du musst noch durch eine Zeit teilen.").
 */
export function explainMismatch(expected: Dims, got: Dims): string {
  const diff = divDims(expected, got);
  const fixes: string[] = [];
  BASE_UNITS.forEach((b, i) => {
    const e = diff[i];
    if (Math.abs(e) < 1e-9) return;
    const abs = Math.abs(e);
    const times = abs === 1 ? '' : abs === 2 ? ' zweimal' : abs === 3 ? ' dreimal' : ` ${abs}-mal`;
    fixes.push(e > 0 ? `${times} mit ${BASE_QTY[b].replace('eine ', 'einer ')} multiplizieren (${b}${e === 1 ? '' : sup(e)})`.trim() : `${times} durch ${BASE_QTY[b]} teilen (${b}${sup(e)})`.trim());
  });
  const exp = describeDims(expected);
  const g = describeDims(got);
  return `Gesucht ist ${exp}, deine Einheit ergibt aber ${g}. Damit die Dimension stimmt, müsstest du noch ${fixes.join(' und ')}.`;
}

/** Zahl im deutschen Format, z. B. 2,39 · 10⁻⁴ */
export function formatNumber(x: number, sig = 3): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(x)));
  if (exp >= -3 && exp < 5) {
    const decimals = Math.max(0, sig - 1 - exp);
    const s = x.toFixed(Math.min(decimals, 10));
    return trimZeros(s).replace('.', ',');
  }
  const mant = x / Math.pow(10, exp);
  let m = trimZeros(mant.toFixed(sig - 1));
  let e = exp;
  if (m === '10' || m === '-10') {
    m = m.startsWith('-') ? '-1' : '1';
    e += 1;
  }
  return `${m.replace('.', ',')} · 10${sup(e)}`;
}
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** Wandelt eine SI-Menge in eine Zieleinheit um */
export function convert(q: Quantity, unit: string): number {
  const u = parseUnit(unit);
  if (!dimsEqual(u.dims, q.dims)) throw new UnitError(explainMismatch(u.dims, q.dims));
  return q.value / u.factor;
}

// ---------------------------------------------------------------------------
// Antwort-Bewertung
// ---------------------------------------------------------------------------

export type Verdict =
  | { kind: 'hit'; relError: number }
  | { kind: 'weak'; power: number }
  | { kind: 'miss'; relError: number }
  | { kind: 'fizzle'; message: string };

/**
 * Vergleicht eine Antwort mit der Lösung.
 *  - falsche Dimension            -> fizzle (Zauber verpufft)
 *  - richtige Ziffern, Faktor 10^k -> weak (trifft schwach)
 *  - innerhalb der Toleranz        -> hit
 */
export function judge(answer: Quantity, expected: Quantity, tolerance = 0.01): Verdict {
  if (!dimsEqual(answer.dims, expected.dims)) {
    return { kind: 'fizzle', message: explainMismatch(expected.dims, answer.dims) };
  }
  const e = expected.value;
  const a = answer.value;
  if (e === 0) {
    return Math.abs(a) <= tolerance ? { kind: 'hit', relError: Math.abs(a) } : { kind: 'miss', relError: Infinity };
  }
  const rel = Math.abs(a - e) / Math.abs(e);
  if (rel <= tolerance) return { kind: 'hit', relError: rel };
  if (a !== 0 && Math.sign(a) === Math.sign(e)) {
    const ratio = a / e;
    const k = Math.round(Math.log10(Math.abs(ratio)));
    if (k !== 0 && Math.abs(ratio / Math.pow(10, k) - 1) <= tolerance) return { kind: 'weak', power: k };
  }
  return { kind: 'miss', relError: rel };
}
