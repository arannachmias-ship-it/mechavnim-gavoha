/**
 * Minimal exact-rational multivariate polynomial algebra.
 * Used by generators to build exercises and canonical step strings.
 */

export type Frac = { n: number; d: number };

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error("division by zero");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
export const F = {
  add: (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  sub: (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  mul: (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d),
  div: (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n),
  neg: (a: Frac) => frac(-a.n, a.d),
  eq: (a: Frac, b: Frac) => a.n === b.n && a.d === b.d,
  isZero: (a: Frac) => a.n === 0,
  isInt: (a: Frac) => a.d === 1,
  toNumber: (a: Frac) => a.n / a.d,
  cmp: (a: Frac, b: Frac) => a.n * b.d - b.n * a.d,
  abs: (a: Frac) => frac(Math.abs(a.n), a.d),
};

/** monomial key: variables sorted, e.g. "x^2 y^1"; constant = "" */
export type Monomial = Record<string, number>;
const keyOf = (m: Monomial) =>
  Object.keys(m)
    .filter((v) => m[v] !== 0)
    .sort()
    .map((v) => `${v}^${m[v]}`)
    .join(" ");
const monoOf = (key: string): Monomial => {
  const m: Monomial = {};
  if (!key) return m;
  for (const part of key.split(" ")) {
    const [v, e] = part.split("^");
    m[v] = Number(e);
  }
  return m;
};

export class Poly {
  terms: Map<string, Frac>;
  constructor(terms?: Map<string, Frac>) {
    this.terms = terms ?? new Map();
  }
  static zero() {
    return new Poly();
  }
  static const(c: number | Frac) {
    const p = new Poly();
    const f = typeof c === "number" ? frac(c) : c;
    if (!F.isZero(f)) p.terms.set("", f);
    return p;
  }
  static term(coef: number | Frac, mono: Monomial) {
    const p = new Poly();
    const f = typeof coef === "number" ? frac(coef) : coef;
    if (!F.isZero(f)) p.terms.set(keyOf(mono), f);
    return p;
  }
  static v(name: string, exp = 1, coef: number | Frac = 1) {
    return Poly.term(coef, { [name]: exp });
  }
  clone() {
    return new Poly(new Map(this.terms));
  }
  isZero() {
    return this.terms.size === 0;
  }
  isConst() {
    return this.terms.size === 0 || (this.terms.size === 1 && this.terms.has(""));
  }
  constValue(): Frac {
    return this.terms.get("") ?? frac(0);
  }
  add(o: Poly) {
    const r = this.clone();
    for (const [k, c] of o.terms) {
      const cur = r.terms.get(k);
      const s = cur ? F.add(cur, c) : c;
      if (F.isZero(s)) r.terms.delete(k);
      else r.terms.set(k, s);
    }
    return r;
  }
  neg() {
    const r = new Poly();
    for (const [k, c] of this.terms) r.terms.set(k, F.neg(c));
    return r;
  }
  sub(o: Poly) {
    return this.add(o.neg());
  }
  scale(c: number | Frac) {
    const f = typeof c === "number" ? frac(c) : c;
    if (F.isZero(f)) return Poly.zero();
    const r = new Poly();
    for (const [k, v] of this.terms) r.terms.set(k, F.mul(v, f));
    return r;
  }
  mul(o: Poly) {
    let r = new Poly();
    for (const [k1, c1] of this.terms)
      for (const [k2, c2] of o.terms) {
        const m1 = monoOf(k1),
          m2 = monoOf(k2);
        const m: Monomial = { ...m1 };
        for (const v of Object.keys(m2)) m[v] = (m[v] ?? 0) + m2[v];
        r = r.add(Poly.term(F.mul(c1, c2), m));
      }
    return r;
  }
  pow(n: number) {
    let r = Poly.const(1);
    for (let i = 0; i < n; i++) r = r.mul(this);
    return r;
  }
  equals(o: Poly) {
    if (this.terms.size !== o.terms.size) return false;
    for (const [k, c] of this.terms) {
      const oc = o.terms.get(k);
      if (!oc || !F.eq(c, oc)) return false;
    }
    return true;
  }
  vars(): string[] {
    const s = new Set<string>();
    for (const k of this.terms.keys()) for (const v of Object.keys(monoOf(k))) s.add(v);
    return [...s].sort();
  }
  degree(): number {
    let d = 0;
    for (const k of this.terms.keys()) {
      const m = monoOf(k);
      const td = Object.values(m).reduce((a, b) => a + b, 0);
      d = Math.max(d, td);
    }
    return d;
  }
  degreeIn(v: string): number {
    let d = 0;
    for (const k of this.terms.keys()) d = Math.max(d, monoOf(k)[v] ?? 0);
    return d;
  }
  /** coefficient of v^e (as polynomial in other vars) */
  coeffOf(v: string, e: number): Poly {
    const r = new Poly();
    for (const [k, c] of this.terms) {
      const m = monoOf(k);
      if ((m[v] ?? 0) === e) {
        const m2 = { ...m };
        delete m2[v];
        r.terms.set(keyOf(m2), c);
      }
    }
    return r;
  }
  /** integer content (gcd of numerators when all coefficients integer) with sign of leading term */
  content(): number {
    let g = 0;
    for (const c of this.terms.values()) {
      if (!F.isInt(c)) return 1;
      g = gcd(g, c.n);
    }
    return g || 1;
  }
  /** monomial gcd of all terms */
  monoGcd(): Monomial {
    let m: Monomial | null = null;
    for (const k of this.terms.keys()) {
      const cur = monoOf(k);
      if (m === null) m = { ...cur };
      else {
        for (const v of Object.keys(m)) {
          if (cur[v] === undefined) delete m[v];
          else m[v] = Math.min(m[v], cur[v]);
        }
      }
    }
    return m ?? {};
  }
  divideByMono(m: Monomial): Poly {
    const r = new Poly();
    for (const [k, c] of this.terms) {
      const cur = monoOf(k);
      for (const v of Object.keys(m)) cur[v] = (cur[v] ?? 0) - m[v];
      r.terms.set(keyOf(cur), c);
    }
    return r;
  }
  /** ordered term list: by total degree desc, then by variable name, then exponent desc */
  orderedTerms(): { mono: Monomial; coef: Frac }[] {
    const arr = [...this.terms.entries()].map(([k, coef]) => ({ mono: monoOf(k), coef, key: k }));
    const deg = (m: Monomial) => Object.values(m).reduce((a, b) => a + b, 0);
    arr.sort((a, b) => {
      const da = deg(a.mono),
        db = deg(b.mono);
      if (da !== db) return db - da;
      // lexicographic on variables (x before y), higher exponent first
      const va = Object.keys(a.mono).sort(),
        vb = Object.keys(b.mono).sort();
      for (let i = 0; i < Math.max(va.length, vb.length); i++) {
        if (va[i] === undefined) return 1;
        if (vb[i] === undefined) return -1;
        if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1;
        if (a.mono[va[i]] !== b.mono[vb[i]]) return b.mono[vb[i]] - a.mono[va[i]];
      }
      return 0;
    });
    return arr;
  }
  evaluate(env: Record<string, number>): number {
    let s = 0;
    for (const [k, c] of this.terms) {
      let t = F.toNumber(c);
      for (const [v, e] of Object.entries(monoOf(k))) t *= Math.pow(env[v] ?? NaN, e);
      s += t;
    }
    return s;
  }
  termCount() {
    return this.terms.size;
  }
}

/* ---------- rendering ---------- */

export function fracLatex(f: Frac, opts: { forceSign?: boolean } = {}): string {
  const sign = f.n < 0 ? "-" : opts.forceSign ? "+" : "";
  const n = Math.abs(f.n);
  if (f.d === 1) return `${sign}${n}`;
  return `${sign}\\frac{${n}}{${f.d}}`;
}

function monoLatex(m: Monomial): string {
  return Object.keys(m)
    .sort()
    .map((v) => (m[v] === 1 ? v : `${v}^{${m[v]}}`))
    .join("");
}

/** LaTeX for a polynomial in canonical textbook order. */
export function polyLatex(p: Poly, opts: { varOrder?: string[] } = {}): string {
  if (p.isZero()) return "0";
  const terms = p.orderedTerms();
  let out = "";
  terms.forEach((t, i) => {
    const mono = monoLatex(t.mono);
    const c = t.coef;
    const neg = c.n < 0;
    const ac = F.abs(c);
    let body: string;
    if (!mono) body = fracLatex(ac);
    else if (F.eq(ac, frac(1))) body = mono;
    else if (ac.d === 1) body = `${ac.n}${mono}`;
    else body = `\\frac{${ac.n}}{${ac.d}}${mono}`;
    if (i === 0) out += (neg ? "-" : "") + body;
    else out += (neg ? "-" : "+") + body;
  });
  void opts;
  return out;
}

/** plain (mathjs-parsable) string */
export function polyPlain(p: Poly): string {
  if (p.isZero()) return "0";
  const terms = p.orderedTerms();
  let out = "";
  terms.forEach((t, i) => {
    const mono = Object.keys(t.mono)
      .sort()
      .map((v) => (t.mono[v] === 1 ? v : `${v}^${t.mono[v]}`))
      .join("*");
    const c = t.coef;
    const neg = c.n < 0;
    const ac = F.abs(c);
    let body: string;
    const cs = ac.d === 1 ? `${ac.n}` : `(${ac.n}/${ac.d})`;
    if (!mono) body = cs;
    else if (F.eq(ac, frac(1))) body = mono;
    else body = `${cs}*${mono}`;
    out += (i === 0 ? (neg ? "-" : "") : neg ? "-" : "+") + body;
  });
  return out;
}

/** wrap in parentheses if polynomial has more than one term or is negative single term */
export function parenIfNeeded(p: Poly): string {
  const s = polyLatex(p);
  if (p.termCount() > 1 || s.startsWith("-")) return `\\left(${s}\\right)`;
  return s;
}

/* ---------- random helpers ----------
   כל ההגרלות עוברות דרך rnd(). כשמגרילים עם "זרע" (seed) אותו תרגיל ייבנה שוב
   בדיוק אותו דבר – כך אפשר לחזור לתרגיל שנגה עצרה באמצע גם אחרי שהדף נסגר. */
let seedState: number | null = null;

/** מגריל 0..1 – Math.random רגיל, או PRNG דטרמיניסטי כשיש זרע */
export function rnd(): number {
  if (seedState === null) return Math.random();
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** מריץ פונקציה עם זרע קבוע (ומחזיר את המגריל למצב רגיל בסוף) */
export function withSeed<T>(seed: number, fn: () => T): T {
  const prev = seedState;
  seedState = (seed >>> 0) || 1;
  try {
    return fn();
  } finally {
    seedState = prev;
  }
}
export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

export function rint(a: number, b: number) {
  return a + Math.floor(rnd() * (b - a + 1));
}
export function rnz(a: number, b: number) {
  let v = 0;
  while (v === 0) v = rint(a, b);
  return v;
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
