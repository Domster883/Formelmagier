import { describe, expect, it } from 'vitest';
import {
  dimsEqual,
  explainMismatch,
  formatDims,
  formatNumber,
  isCoherentSI,
  judge,
  parseNumber,
  parseNumberList,
  parseQuantity,
  parseUnit,
  toQuantity,
} from '../src/engine/units';
import { evaluateScalar } from '../src/engine/expr';

const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel);

describe('Zahlen mit Dezimalkomma', () => {
  it.each([
    ['2,39', 2.39],
    ['2.39', 2.39],
    ['-0,5', -0.5],
    ['2,39e-4', 2.39e-4],
    ['2,39·10^-4', 2.39e-4],
    ['2,39 × 10⁻⁴', 2.39e-4],
    ['2,39*10^(-4)', 2.39e-4],
    ['5,56 x 10^-11', 5.56e-11],
    ['10^5', 1e5],
    ['10⁻³', 1e-3],
    ['1 750', 1750],
  ])('%s -> %d', (s, v) => close(parseNumber(s), v));

  it('lehnt Unsinn ab', () => {
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('2,3,4')).toBeNaN();
  });

  it('Messreihen mit ; oder Leerzeichen', () => {
    expect(parseNumberList('2,43; 2,51; 2,47')).toEqual([2.43, 2.51, 2.47]);
    expect(parseNumberList('2,43 2,51  2,47')).toEqual([2.43, 2.51, 2.47]);
  });
});

describe('Basiseinheiten und Vorsilben', () => {
  it('7 SI-Basiseinheiten', () => {
    expect(formatDims(parseUnit('m').dims)).toBe('m');
    expect(formatDims(parseUnit('kg').dims)).toBe('kg');
    expect(formatDims(parseUnit('s').dims)).toBe('s');
    expect(formatDims(parseUnit('A').dims)).toBe('A');
    expect(formatDims(parseUnit('K').dims)).toBe('K');
    expect(formatDims(parseUnit('mol').dims)).toBe('mol');
    expect(formatDims(parseUnit('cd').dims)).toBe('cd');
    expect(parseUnit('kg').factor).toBeCloseTo(1);
  });

  it.each([
    ['µg', 1e-9],
    ['ug', 1e-9],
    ['mg', 1e-6],
    ['cm', 1e-2],
    ['dm', 1e-1],
    ['km', 1e3],
    ['MW', 1e6],
    ['GJ', 1e9],
    ['nm', 1e-9],
    ['mm', 1e-3],
    ['ms', 1e-3],
    ['hPa', 100],
    ['kWh', 3.6e6],
    ['MWh', 3.6e9],
  ])('%s hat Faktor %d', (u, f) => close(parseUnit(u).factor, f));

  it('Potenzen von Vorsilben-Einheiten', () => {
    close(parseUnit('dm²').factor, 1e-2);
    close(parseUnit('mm^2').factor, 1e-6);
    close(parseUnit('cm³').factor, 1e-6);
    close(parseUnit('m2').factor, 1);
    expect(formatDims(parseUnit('cm³').dims)).toBe('m³');
  });

  it('Sondereinheiten', () => {
    close(parseUnit('ha').factor, 1e4);
    close(parseUnit('h').factor, 3600);
    close(parseUnit('min').factor, 60);
    close(parseUnit('L').factor, 1e-3);
    close(parseUnit('kp').factor, 9.81);
    close(parseUnit('t').factor, 1000);
    close(parseUnit('Jahr').factor, 365 * 86400);
  });

  it('unbekannte Einheit wirft Fehler', () => {
    expect(() => parseUnit('Xyz')).toThrow(/Unbekannte Einheit/);
  });
});

describe('abgeleitete Einheiten', () => {
  it.each([
    ['N', 'kg·m·s⁻²'],
    ['J', 'kg·m²·s⁻²'],
    ['W', 'kg·m²·s⁻³'],
    ['Pa', 'kg·m⁻¹·s⁻²'],
    ['Hz', 's⁻¹'],
    ['V', 'kg·m²·s⁻³·A⁻¹'],
    ['Ω', 'kg·m²·s⁻³·A⁻²'],
  ])('%s = %s', (u, dims) => expect(formatDims(parseUnit(u).dims)).toBe(dims));

  it('N = kg·m/s², J = N·m, W = J/s, Pa = N/m²', () => {
    expect(dimsEqual(parseUnit('N').dims, parseUnit('kg*m/s^2').dims)).toBe(true);
    expect(dimsEqual(parseUnit('J').dims, parseUnit('N·m').dims)).toBe(true);
    expect(dimsEqual(parseUnit('J').dims, parseUnit('N.m').dims)).toBe(true);
    expect(dimsEqual(parseUnit('W').dims, parseUnit('J/s').dims)).toBe(true);
    expect(dimsEqual(parseUnit('Pa').dims, parseUnit('N/m²').dims)).toBe(true);
    expect(dimsEqual(parseUnit('Hz').dims, parseUnit('1/s').dims)).toBe(true);
  });

  it('Nenner-Konvention: alles nach "/" steht im Nenner', () => {
    const a = parseUnit('kg/(m²·s)');
    const b = parseUnit('kg/m²s');
    const c = parseUnit('kg m^-2 s^-1');
    const e = parseUnit('kg·m⁻²·s⁻¹');
    expect(dimsEqual(a.dims, b.dims)).toBe(true);
    expect(dimsEqual(a.dims, c.dims)).toBe(true);
    expect(dimsEqual(a.dims, e.dims)).toBe(true);
    expect(formatDims(a.dims)).toBe('kg·m⁻²·s⁻¹');
  });

  it('km/h', () => close(parseUnit('km/h').factor, 1 / 3.6));
  it('kohärente SI-Einheiten', () => {
    expect(isCoherentSI('kg/(m²·s)')).toBe(true);
    expect(isCoherentSI('N·m')).toBe(true);
    expect(isCoherentSI('g/(dm²·h)')).toBe(false);
  });
});

describe('Größen und Bewertung', () => {
  it('parseQuantity', () => {
    const qq = parseQuantity('13 dm²');
    close(qq.value, 0.13);
    const r = parseQuantity('2,39·10^-4 kg/(m²·s)');
    close(r.value, 2.39e-4);
    close(parseQuantity('19,3 g/cm³').value, 19300);
  });

  it('Treffer, schwacher Treffer, Verpuffen', () => {
    const expected = toQuantity(2.39e-4, 'kg/(m^2*s)');
    expect(judge(toQuantity(2.39e-4, 'kg/m²s'), expected).kind).toBe('hit');
    expect(judge(toQuantity(0.239, 'g/(m²·s)'), expected).kind).toBe('hit');
    const weak = judge(toQuantity(2.39e-1, 'kg/(m²·s)'), expected);
    expect(weak).toEqual({ kind: 'weak', power: 3 });
    const fizz = judge(toQuantity(2.39e-4, 'kg/m²'), expected);
    expect(fizz.kind).toBe('fizzle');
    if (fizz.kind === 'fizzle') expect(fizz.message).toMatch(/durch eine Zeit teilen/);
    expect(judge(toQuantity(3e-4, 'kg/(m²·s)'), expected).kind).toBe('miss');
  });

  it('Toleranz ±1 %', () => {
    const e = toQuantity(100, 'N');
    expect(judge(toQuantity(100.9, 'N'), e).kind).toBe('hit');
    expect(judge(toQuantity(101.5, 'N'), e).kind).toBe('miss');
    expect(judge(toQuantity(101.5, 'N'), e, 0.02).kind).toBe('hit');
  });

  it('Fehlererklärung nennt die fehlende Dimension', () => {
    const msg = explainMismatch(parseUnit('m/s').dims, parseUnit('m').dims);
    expect(msg).toMatch(/Geschwindigkeit/);
    expect(msg).toMatch(/s⁻¹/);
  });

  it('formatNumber', () => {
    expect(formatNumber(2.393e-4)).toBe('2,39 · 10⁻⁴');
    expect(formatNumber(1750)).toBe('1750');
    expect(formatNumber(0.0447)).toBe('0,0447');
    expect(formatNumber(8.028e11)).toBe('8,03 · 10¹¹');
  });
});

describe('Formel-Auswertung', () => {
  it('rechnet mit Einheiten', () => {
    const r = evaluateScalar('m / (A * t)', {
      m: parseQuantity('112 g'),
      A: parseQuantity('13 dm²'),
      t: parseQuantity('1 h'),
    });
    close(r.value, 0.112 / (0.13 * 3600));
    expect(formatDims(r.dims)).toBe('kg·m⁻²·s⁻¹');
  });
  it('Addition verschiedener Dimensionen schlägt fehl', () => {
    expect(() => evaluateScalar('a + b', { a: parseQuantity('1 m'), b: parseQuantity('1 s') })).toThrow();
  });
  it('Statistik', () => {
    const x = { list: [2.43, 2.51, 2.47, 2.39, 2.45], dims: parseUnit('s').dims };
    close(evaluateScalar('mean(x)', { x }).value, 2.45);
    close(evaluateScalar('std(x)', { x }).value, Math.sqrt(0.002));
  });
  it('Wurzel halbiert Exponenten', () => {
    const r = evaluateScalar('sqrt(Fx^2 + Fy^2)', { Fx: parseQuantity('30 N'), Fy: parseQuantity('40 N') });
    close(r.value, 50);
    expect(formatDims(r.dims)).toBe('kg·m·s⁻²');
  });
});
