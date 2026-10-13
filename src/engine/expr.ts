/**
 * Kleiner Formel-Auswerter für Zaubersprüche: rechnet mit physikalischen
 * Größen (Wert + Dimension) und prüft dabei die Dimensionen.
 *   evaluate("m / (A * t)", { m: q(0.112, kg), A: …, t: … })
 */
import {
  DIMLESS,
  Dims,
  Quantity,
  UnitError,
  describeDims,
  dimsEqual,
  divDims,
  isDimless,
  mulDims,
  powDims,
} from './units';

export interface ListQuantity {
  list: number[];
  dims: Dims;
}
export type Value = Quantity | ListQuantity;

export function isList(v: Value): v is ListQuantity {
  return (v as ListQuantity).list !== undefined;
}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      toks.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*/.exec(src.slice(i));
    if (id) {
      toks.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new UnitError(`Unerwartetes Zeichen „${c}“ in Formel`);
  }
  return toks;
}

const q = (value: number, dims: Dims = [...DIMLESS] as Dims): Quantity => ({ value, dims });

function scalar(v: Value, ctx: string): Quantity {
  if (isList(v)) throw new UnitError(`${ctx}: hier wird ein Einzelwert erwartet, keine Messreihe`);
  return v;
}

function list(v: Value, fn: string): ListQuantity {
  if (!isList(v)) return { list: [v.value], dims: v.dims };
  if (v.list.length === 0) throw new UnitError(`${fn}: Messreihe ist leer`);
  void fn;
  return v;
}

const FUNCS: Record<string, (args: Value[]) => Value> = {
  sqrt: ([a]) => {
    const x = scalar(a, 'sqrt');
    return q(Math.sqrt(x.value), powDims(x.dims, 0.5));
  },
  abs: ([a]) => {
    const x = scalar(a, 'abs');
    return q(Math.abs(x.value), x.dims);
  },
  sum: ([a]) => {
    const l = list(a, 'sum');
    return q(l.list.reduce((s, x) => s + x, 0), l.dims);
  },
  count: ([a]) => q(list(a, 'count').list.length),
  mean: ([a]) => {
    const l = list(a, 'mean');
    return q(l.list.reduce((s, x) => s + x, 0) / l.list.length, l.dims);
  },
  /** empirische Standardabweichung (Division durch n − 1) */
  std: ([a]) => {
    const l = list(a, 'std');
    const n = l.list.length;
    if (n < 2) throw new UnitError('Für die Standardabweichung braucht man mindestens 2 Messwerte');
    const m = l.list.reduce((s, x) => s + x, 0) / n;
    const ss = l.list.reduce((s, x) => s + (x - m) ** 2, 0);
    return q(Math.sqrt(ss / (n - 1)), l.dims);
  },
  sin: ([a]) => q(Math.sin(dimless(a, 'sin'))),
  cos: ([a]) => q(Math.cos(dimless(a, 'cos'))),
  tan: ([a]) => q(Math.tan(dimless(a, 'tan'))),
  ln: ([a]) => q(Math.log(dimless(a, 'ln'))),
  exp: ([a]) => q(Math.exp(dimless(a, 'exp'))),
};

function dimless(v: Value, fn: string): number {
  const x = scalar(v, fn);
  if (!isDimless(x.dims)) throw new UnitError(`${fn}(…) braucht eine dimensionslose Größe, bekommen: ${describeDims(x.dims)}`);
  return x.value;
}

const CONSTS: Record<string, Quantity> = {
  pi: q(Math.PI),
  π: q(Math.PI),
};

class Parser {
  private pos = 0;
  constructor(private toks: Tok[], private vars: Record<string, Value>) {}

  run(): Value {
    const v = this.add();
    if (this.pos < this.toks.length) throw new UnitError('Formel nicht vollständig gelesen');
    return v;
  }
  private peekOp(op: string) {
    const t = this.toks[this.pos];
    return t && t.t === 'op' && t.v === op;
  }
  private add(): Value {
    let a = this.mul();
    while (this.peekOp('+') || this.peekOp('-')) {
      const op = (this.toks[this.pos++] as { v: string }).v;
      const b = this.mul();
      const x = scalar(a, op);
      const y = scalar(b, op);
      if (!dimsEqual(x.dims, y.dims)) {
        throw new UnitError(`Man kann ${describeDims(x.dims)} und ${describeDims(y.dims)} nicht addieren/subtrahieren`);
      }
      a = q(op === '+' ? x.value + y.value : x.value - y.value, x.dims);
    }
    return a;
  }
  private mul(): Value {
    let a = this.unary();
    while (this.peekOp('*') || this.peekOp('/')) {
      const op = (this.toks[this.pos++] as { v: string }).v;
      const b = this.unary();
      const x = scalar(a, op);
      const y = scalar(b, op);
      a = op === '*' ? q(x.value * y.value, mulDims(x.dims, y.dims)) : q(x.value / y.value, divDims(x.dims, y.dims));
    }
    return a;
  }
  private unary(): Value {
    if (this.peekOp('-')) {
      this.pos++;
      const x = scalar(this.unary(), '-');
      return q(-x.value, x.dims);
    }
    if (this.peekOp('+')) {
      this.pos++;
      return this.unary();
    }
    return this.pow();
  }
  private pow(): Value {
    const base = this.primary();
    if (this.peekOp('^')) {
      this.pos++;
      const e = dimless(this.unary(), '^');
      const b = scalar(base, '^');
      return q(Math.pow(b.value, e), powDims(b.dims, e));
    }
    return base;
  }
  private primary(): Value {
    const t = this.toks[this.pos++];
    if (!t) throw new UnitError('Formel unvollständig');
    if (t.t === 'num') return q(t.v);
    if (t.t === 'id') {
      if (this.peekOp('(')) {
        const fn = FUNCS[t.v];
        if (!fn) throw new UnitError(`Unbekannte Funktion ${t.v}`);
        this.pos++;
        const args: Value[] = [this.add()];
        while (this.peekOp(',')) {
          this.pos++;
          args.push(this.add());
        }
        if (!this.peekOp(')')) throw new UnitError('„)“ fehlt');
        this.pos++;
        return fn(args);
      }
      if (t.v in this.vars) return this.vars[t.v];
      if (t.v in CONSTS) return CONSTS[t.v];
      throw new UnitError(`Unbekannte Größe ${t.v}`);
    }
    if (t.v === '(') {
      const v = this.add();
      if (!this.peekOp(')')) throw new UnitError('„)“ fehlt');
      this.pos++;
      return v;
    }
    throw new UnitError(`Unerwartetes „${t.v}“ in Formel`);
  }
}

export function evaluate(expr: string, vars: Record<string, Value>): Value {
  return new Parser(tokenize(expr), vars).run();
}

export function evaluateScalar(expr: string, vars: Record<string, Value>): Quantity {
  const v = evaluate(expr, vars);
  if (isList(v)) throw new UnitError('Ergebnis ist eine Messreihe, erwartet wurde ein Einzelwert');
  return v;
}

export { dimsEqual };
