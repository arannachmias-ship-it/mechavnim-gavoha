import { create, all, MathNode } from "mathjs";

const math = create(all, { number: "number" });

/* ---------------- input normalisation ---------------- */

/** Convert MathLive LaTeX (or plain typed text) into a mathjs-parsable string. */
export function normalizeInput(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // unicode / typography
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[·×⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/(?<=[\d)a-zA-Z}])\s*:\s*(?=[\d(a-zA-Z\\])/g, "/") // 12:3 → 12/3 (סימון חילוק ישראלי)
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    .replace(/,/g, ".");
  // latex commands
  s = s
    .replace(/\\left\s*\(/g, "(")
    .replace(/\\right\s*\)/g, ")")
    .replace(/\\left\s*\[/g, "(")
    .replace(/\\right\s*\]/g, ")")
    .replace(/\\left\s*\\{/g, "(")
    .replace(/\\right\s*\\}/g, ")")
    .replace(/\\left\s*\|/g, "abs(")
    .replace(/\\right\s*\|/g, ")")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pm/g, "±")
    .replace(/\\,|\\;|\\:|\\!|\\quad|~/g, " ")
    .replace(/\\operatorname\{([a-z]+)\}/g, "$1")
    .replace(/\\mathrm\{([a-zA-Z]+)\}/g, "$1")
    .replace(/\\text\{[^}]*\}/g, " ");
  // \frac{a}{b} (iterate for nesting)
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(/\\(?:d|t)?frac\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, "(($1)/($2))");
    s = s.replace(/\\frac\s*(\d)(\d)/g, "(($1)/($2))");
    if (before === s) break;
  }
  // \sqrt{a}, \sqrt[n]{a}
  s = s.replace(/\\sqrt\s*\[(\d+)\]\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, "nthRoot($2,$1)");
  s = s.replace(/\\sqrt\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, "sqrt($1)");
  s = s.replace(/\\sqrt\s*(\d+)/g, "sqrt($1)");
  // subscripts x_1 -> x1 (variable names), and drop remaining backslashes
  s = s.replace(/_\{([^}]*)\}/g, "$1").replace(/_(\w)/g, "$1");
  s = s.replace(/\\/g, "");
  // braces to parens (exponents like ^{12})
  s = s.replace(/\{/g, "(").replace(/\}/g, ")");
  // implicit multiplication: protect function names
  s = s.replace(/sqrt/g, "#").replace(/nthRoot/g, "@").replace(/abs/g, "$");
  s = s.replace(/\s+/g, "");
  s = s
    .replace(/([a-zA-Z])(?=[a-zA-Z])/g, "$1*") // xy -> x*y
    .replace(/(\d)(?=[a-zA-Z#@$(])/g, "$1*") // 2x, 2( , 2sqrt
    .replace(/([a-zA-Z])(?=[(#@$])/g, "$1*") // x( , xsqrt
    .replace(/(\))(?=[a-zA-Z0-9(#@$])/g, "$1*"); // )( , )x
  s = s.replace(/#/g, "sqrt").replace(/@/g, "nthRoot").replace(/\$/g, "abs");
  return s;
}

export function parseExpr(input: string): MathNode | null {
  try {
    const s = normalizeInput(input);
    if (!s) return null;
    return math.parse(s);
  } catch {
    return null;
  }
}

/* ---------------- numeric equivalence ---------------- */

function samplePoints(vars: string[], n = 7): Record<string, number>[] {
  const pts: Record<string, number>[] = [];
  const seed = [1.37, -2.11, 0.53, 2.71, -0.79, 1.93, -1.49, 0.31, 3.17, -2.63];
  for (let i = 0; i < n; i++) {
    const env: Record<string, number> = {};
    vars.forEach((v, j) => {
      env[v] = seed[(i * 3 + j * 5) % seed.length] + (i % 2 ? 0.013 * (j + 1) : -0.017 * (j + 2));
    });
    pts.push(env);
  }
  return pts;
}

function collectVars(node: MathNode): string[] {
  const s = new Set<string>();
  node.traverse((n) => {
    if (n.type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      if (!["e", "pi", "i"].includes(name) && !math[name as keyof typeof math]) s.add(name);
    }
  });
  return [...s].sort();
}

function evalAt(node: MathNode, env: Record<string, number>): number | null {
  try {
    const v = node.evaluate(env);
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (v && typeof v === "object" && "re" in v) {
      const c = v as { re: number; im: number };
      if (Math.abs(c.im) > 1e-9) return NaN; // complex: mark specially
      return Number.isFinite(c.re) ? c.re : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Are two expression strings equivalent (numerically, on random points)? */
export function exprEquivalent(a: string, b: string): boolean {
  const na = parseExpr(a),
    nb = parseExpr(b);
  if (!na || !nb) return false;
  return nodesEquivalent(na, nb);
}

export function nodesEquivalent(na: MathNode, nb: MathNode): boolean {
  const vars = [...new Set([...collectVars(na), ...collectVars(nb)])].sort();
  const pts = samplePoints(vars.length ? vars : ["x"], 8);
  let valid = 0;
  for (const env of pts) {
    const va = evalAt(na, env),
      vb = evalAt(nb, env);
    if (va === null || vb === null) continue;
    if (Number.isNaN(va) && Number.isNaN(vb)) {
      valid++;
      continue;
    }
    if (Number.isNaN(va) || Number.isNaN(vb)) return false;
    valid++;
    const scale = Math.max(1, Math.abs(va), Math.abs(vb));
    if (Math.abs(va - vb) > 1e-8 * scale) return false;
  }
  return valid >= 3;
}

/** ratio a/b constant on random points (equations equivalent up to constant factor) */
export function exprProportional(a: string, b: string): boolean {
  const na = parseExpr(a),
    nb = parseExpr(b);
  if (!na || !nb) return false;
  const vars = [...new Set([...collectVars(na), ...collectVars(nb)])].sort();
  const pts = samplePoints(vars.length ? vars : ["x"], 8);
  let ratio: number | null = null;
  let valid = 0;
  for (const env of pts) {
    const va = evalAt(na, env),
      vb = evalAt(nb, env);
    if (va === null || vb === null || Number.isNaN(va) || Number.isNaN(vb)) continue;
    if (Math.abs(vb) < 1e-12 && Math.abs(va) < 1e-12) continue;
    if (Math.abs(vb) < 1e-12) return false;
    const r = va / vb;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-7 * Math.max(1, Math.abs(ratio))) return false;
    valid++;
  }
  return valid >= 3 && ratio !== null && Math.abs(ratio) > 1e-12;
}

/* ---------------- polynomial roots ---------------- */

/** coefficients ascending (c0 + c1 x + ...). Returns real roots (deduped). */
export function polyRootsReal(coeffs: number[]): number[] {
  const c = [...coeffs];
  while (c.length && Math.abs(c[c.length - 1]) < 1e-12) c.pop();
  const deg = c.length - 1;
  if (deg < 1) return [];
  const lead = c[deg];
  const a = c.map((x) => x / lead); // monic
  if (deg === 1) return [-a[0]];
  if (deg === 2) {
    const disc = a[1] * a[1] - 4 * a[0];
    if (disc < -1e-12) return [];
    if (Math.abs(disc) < 1e-12) return [-a[1] / 2];
    const s = Math.sqrt(disc);
    return [(-a[1] - s) / 2, (-a[1] + s) / 2].sort((p, q) => p - q);
  }
  // Durand-Kerner
  type C = { re: number; im: number };
  const cmul = (p: C, q: C): C => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const csub = (p: C, q: C): C => ({ re: p.re - q.re, im: p.im - q.im });
  const cdiv = (p: C, q: C): C => {
    const d = q.re * q.re + q.im * q.im;
    return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d };
  };
  const evalP = (z: C): C => {
    let r: C = { re: 0, im: 0 };
    for (let k = deg; k >= 0; k--) r = { re: cmul(r, z).re + a[k], im: cmul(r, z).im };
    return r;
  };
  let roots: C[] = [];
  for (let k = 0; k < deg; k++) {
    const ang = (2 * Math.PI * k) / deg + 0.4;
    roots.push({ re: 0.9 * Math.cos(ang), im: 0.9 * Math.sin(ang) });
  }
  for (let iter = 0; iter < 500; iter++) {
    const next: C[] = roots.map((z, i) => {
      let denom: C = { re: 1, im: 0 };
      roots.forEach((w, j) => {
        if (i !== j) denom = cmul(denom, csub(z, w));
      });
      return csub(z, cdiv(evalP(z), denom));
    });
    let delta = 0;
    next.forEach((z, i) => (delta = Math.max(delta, Math.abs(z.re - roots[i].re) + Math.abs(z.im - roots[i].im))));
    roots = next;
    if (delta < 1e-13) break;
  }
  const real = roots.filter((z) => Math.abs(z.im) < 1e-6).map((z) => z.re);
  const out: number[] = [];
  for (const r of real.sort((p, q) => p - q)) {
    if (!out.length || Math.abs(out[out.length - 1] - r) > 1e-6) out.push(r);
  }
  return out;
}

/* ---------------- equations ---------------- */

export type SolutionSet =
  | { kind: "finite"; roots: number[]; excluded: number[] }
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "unknown" };

/** Solution set of a single-variable equation "L = R" in variable v. */
export function solutionSet(eq: string, v = "x"): SolutionSet {
  const parts = eq.split("=");
  if (parts.length !== 2) return { kind: "unknown" };
  const L = normalizeInput(parts[0]),
    R = normalizeInput(parts[1]);
  if (!L || !R) return { kind: "unknown" };
  try {
    const diff = `(${L})-(${R})`;
    const node = math.parse(diff);
    const vars = collectVars(node);
    if (vars.length > 1) return { kind: "unknown" };
    if (vars.length === 0) {
      const val = evalAt(node, {});
      if (val === null) return { kind: "unknown" };
      return Math.abs(val) < 1e-9 ? { kind: "all" } : { kind: "none" };
    }
    const varName = vars[0];
    const r = math.rationalize(diff.replace(new RegExp(`\\b${varName}\\b`, "g"), "x"), {}, true) as unknown as {
      numerator: MathNode;
      denominator: MathNode | null;
      coefficients: number[];
    };
    const numCoeffs = r.coefficients;
    if (!numCoeffs || !numCoeffs.length) {
      // rationalize returns no coefficients when the difference is identically 0
      // ...or when the variable cancels out entirely (a nonzero constant → no solution)
      const v1 = evalAt(node, { [varName]: 1.234 }),
        v2 = evalAt(node, { [varName]: -0.77 });
      if (v1 === null || v2 === null) return { kind: "unknown" };
      if (Math.abs(v1) < 1e-9 && Math.abs(v2) < 1e-9) return { kind: "all" };
      if (Math.abs(v1 - v2) < 1e-9) return { kind: "none" };
      return { kind: "unknown" };
    }
    let excluded: number[] = [];
    if (r.denominator) {
      try {
        const rd = math.rationalize(r.denominator.toString(), {}, true) as unknown as { coefficients: number[] };
        excluded = polyRootsReal(rd.coefficients);
      } catch {
        /* ignore */
      }
    }
    const nonZero = numCoeffs.some((c) => Math.abs(c) > 1e-12);
    if (!nonZero) return { kind: "all" };
    if (numCoeffs.length === 1) return { kind: "none" };
    let roots = polyRootsReal(numCoeffs);
    roots = roots.filter((x) => !excluded.some((e) => Math.abs(e - x) < 1e-7));
    if (!roots.length) return { kind: "none" };
    return { kind: "finite", roots, excluded };
  } catch {
    return { kind: "unknown" };
  }
}

export function sameRoots(a: number[], b: number[], tol = 1e-6) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((p, q) => p - q),
    sb = [...b].sort((p, q) => p - q);
  return sa.every((x, i) => Math.abs(x - sb[i]) < tol * Math.max(1, Math.abs(x)));
}

/* ---------------- structure analysis ---------------- */

export function nodeCount(node: MathNode): number {
  let c = 0;
  node.traverse((n) => {
    if (n.type !== "ParenthesisNode") c++;
  });
  return c;
}
/** parentheses that wrap a sum/difference (the ones that matter for "expanded") */
export function parenCount(node: MathNode): number {
  let c = 0;
  node.traverse((n) => {
    if (n.type === "ParenthesisNode") {
      const content = (n as unknown as { content: MathNode }).content;
      if (content.type === "OperatorNode") {
        const op = (content as unknown as { op: string; args: MathNode[] }).op;
        const args = (content as unknown as { args: MathNode[] }).args;
        if ((op === "+" || op === "-") && args.length === 2) c++;
      }
    }
  });
  return c;
}
export function hasDivision(node: MathNode): boolean {
  let f = false;
  node.traverse((n) => {
    if (n.type === "OperatorNode" && (n as unknown as { op: string }).op === "/") f = true;
  });
  return f;
}
export function nodeVars(node: MathNode) {
  return collectVars(node);
}

/** "x = 5" style final answer? returns value or null */
export function parseFinalAssignment(input: string, v: string): number | "none" | "all" | null {
  const t = input.trim();
  if (/אין\s*פתרון|אין\s*x|none/i.test(t)) return "none";
  if (/כל\s*x|כל\s*ה?מספרים|אינסוף|all/i.test(t)) return "all";
  const parts = t.split("=");
  if (parts.length !== 2) return null;
  const lhs = normalizeInput(parts[0]);
  const rhs = normalizeInput(parts[1]);
  const [a, b] = lhs === v ? [lhs, rhs] : rhs === v ? [rhs, lhs] : [null, null];
  if (!a || !b) return null;
  try {
    const node = math.parse(b);
    if (collectVars(node).length) return null;
    const val = evalAt(node, {});
    return val === null || Number.isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

/** parse "x=2, x=-3" / "x=2 או x=-3" / "x=±3" into list of values */
export function parseMultiAssignment(input: string, v: string): number[] | null {
  let t = input.replace(/או|or|;|\|/g, ",");
  // x=±3
  const pm = t.match(/^\s*([a-z])\s*=\s*±\s*(.+)$/);
  if (pm) {
    const val = parseFinalAssignment(`${pm[1]}=${pm[2]}`, v);
    if (typeof val === "number") return [val, -val];
  }
  t = t.replace(/x_?1|x_?2|x₁|x₂/g, v);
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  const vals: number[] = [];
  for (const p of parts) {
    const val = parseFinalAssignment(p, v);
    if (typeof val !== "number") return null;
    vals.push(val);
  }
  return vals.length ? vals : null;
}

/** Split an input possibly containing "=" */
export function splitEquation(input: string): { lhs: string; rhs: string } | null {
  const parts = input.split("=");
  if (parts.length !== 2) return null;
  return { lhs: parts[0], rhs: parts[1] };
}

export { math };
