/**
 * בדיקת *תהליך* בסדר פעולות חשבון (ביטויים מספריים):
 * לא רק "האם השורה שווה" אלא "האם היא נובעת מהשורה הקודמת לפי הסדר של השיטה":
 *   סוגריים (הפנימיים קודם) → חזקות/שורשים → כפל/חילוק → חיבור/חיסור,
 *   ובתוך שרשרת של אותה דרגה – משמאל לימין, לפי מי שהגיע ראשון.
 * מותר לדלג על כמה שלבים בשורה אחת, כל עוד כל אחד מהם חוקי.
 * גושים בלתי תלויים (למשל שני מכפלות בסכום) מותר לחשב בכל סדר.
 */
import type { MathNode } from "mathjs";
import { parseExpr } from "./check";

type Op = { type: "op"; op: string; args: Node[] };
type Fn = { type: "fn"; name: string; args: Node[] };
type Num = { type: "num"; value: number };
type Node = Op | Fn | Num;

const PRIO: Record<string, number> = { "^": 3, sqrt: 3, nthRoot: 3, "*": 2, "/": 2, "+": 1, "-": 1 };

function fromMath(n: MathNode): Node | null {
  switch (n.type) {
    case "ParenthesisNode":
      return fromMath((n as unknown as { content: MathNode }).content);
    case "ConstantNode": {
      const v = (n as unknown as { value: unknown }).value;
      return typeof v === "number" ? { type: "num", value: v } : null;
    }
    case "OperatorNode": {
      const o = n as unknown as { op: string; fn: string; args: MathNode[] };
      const args = o.args.map(fromMath);
      if (args.some((a) => !a)) return null;
      if (o.fn === "unaryMinus") {
        const a = args[0] as Node;
        if (a.type === "num") return { type: "num", value: -a.value };
        return { type: "op", op: "neg", args: [a] };
      }
      if (o.fn === "unaryPlus") return args[0];
      if (!["+", "-", "*", "/", "^"].includes(o.op) || args.length !== 2) return null;
      return { type: "op", op: o.op, args: args as Node[] };
    }
    case "FunctionNode": {
      const f = n as unknown as { fn: { name: string }; args: MathNode[] };
      const args = f.args.map(fromMath);
      if (args.some((a) => !a)) return null;
      if (!["sqrt", "nthRoot", "abs"].includes(f.fn.name)) return null;
      return { type: "fn", name: f.fn.name, args: args as Node[] };
    }
    default:
      return null;
  }
}

/** צורה קנונית: a+(-c) ≡ a-c, a-(-c) ≡ a+c, neg(num) ≡ num שלילי, מספרים מעוגלים */
function canon(n: Node): Node {
  if (n.type === "num") return { type: "num", value: Math.round(n.value * 1e9) / 1e9 };
  if (n.type === "fn") return { type: "fn", name: n.name, args: n.args.map(canon) };
  const args = n.args.map(canon);
  if (n.op === "neg" && args[0].type === "num") return { type: "num", value: -args[0].value };
  if ((n.op === "+" || n.op === "-") && args[1].type === "num" && args[1].value < 0) {
    return { type: "op", op: n.op === "+" ? "-" : "+", args: [args[0], { type: "num", value: -args[1].value }] };
  }
  return { type: "op", op: n.op, args };
}

function key(n: Node): string {
  if (n.type === "num") return String(n.value);
  if (n.type === "fn") return `${n.name}(${n.args.map(key).join(",")})`;
  return `(${n.op} ${n.args.map(key).join(" ")})`;
}

function isNum(n: Node): n is Num {
  return n.type === "num";
}

function evalOp(n: Node): number | null {
  if (n.type === "num") return n.value;
  if (n.type === "fn") {
    const a = n.args.map((x) => (isNum(x) ? x.value : NaN));
    if (n.name === "sqrt") return Math.sqrt(a[0]);
    if (n.name === "abs") return Math.abs(a[0]);
    if (n.name === "nthRoot") return Math.pow(a[0], 1 / a[1]);
    return null;
  }
  const a = n.args.map((x) => (isNum(x) ? x.value : NaN));
  switch (n.op) {
    case "+": return a[0] + a[1];
    case "-": return a[0] - a[1];
    case "*": return a[0] * a[1];
    case "/": return a[0] / a[1];
    case "^": return Math.pow(a[0], a[1]);
    case "neg": return -a[0];
  }
  return null;
}

/** תיאור פעולה לרמז: "30−19=11" */
export function describe(n: Node): string {
  const f = (x: number) => (x < 0 ? `(${fmt(x)})` : fmt(x));
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
  const v = evalOp(n);
  const vs = v === null ? "?" : fmt(v);
  if (n.type === "fn") {
    if (n.name === "sqrt") return `√${(n.args[0] as Num).value}=${vs}`;
    return `${n.name}=${vs}`;
  }
  if (n.type === "op") {
    const [a, b] = n.args as Num[];
    if (n.op === "neg") return `−${f(a.value)}=${vs}`;
    const sym = n.op === "*" ? "·" : n.op === "/" ? ":" : n.op === "-" ? "−" : n.op === "^" ? "^" : "+";
    if (n.op === "^") return `${f(a.value)}${b.value === 2 ? "²" : b.value === 3 ? "³" : "^" + b.value}=${vs}`;
    return `${f(a.value)}${sym}${f(b.value)}=${vs}`;
  }
  return vs;
}

/**
 * הצעדים החוקיים לפי השיטה:
 *  - "שרשרת" = רצף פעולות מאותה דרגה (a−b+c, a:b·c). בשרשרת מותר לבצע רק את הזוג השמאלי ביותר,
 *    ורק אחרי שכל האיברים בשרשרת כבר מספרים (הסנובים – סוגריים, חזקות, כפל – קודם).
 *  - חזקה / שורש / מינוס-לפני-סוגריים שכל האופרנדים שלהם מספרים – מותר.
 *  - גושים בלתי תלויים (למשל שתי מכפלות בסכום) – בכל סדר.
 */
function legalSteps(root: Node): { path: number[]; node: Node }[] {
  const out: { path: number[]; node: Node }[] = [];
  const walk = (n: Node, path: number[]) => {
    if (n.type === "num") return;
    if (n.type === "fn") {
      if (n.args.every(isNum)) out.push({ path, node: n });
      else n.args.forEach((a, i) => walk(a, [...path, i]));
      return;
    }
    if (n.op === "neg" || n.op === "^") {
      if (n.args.every(isNum)) out.push({ path, node: n });
      else n.args.forEach((a, i) => walk(a, [...path, i]));
      return;
    }
    const prio = PRIO[n.op];
    // flatten the left spine of same-priority ops → chain items
    const items: { node: Node; path: number[] }[] = [];
    let cur: Node = n,
      curPath = path,
      leftmost: { node: Node; path: number[] } = { node: n, path };
    for (;;) {
      const c = cur as Op;
      items.unshift({ node: c.args[1], path: [...curPath, 1] });
      const l = c.args[0];
      if (l.type === "op" && PRIO[l.op] === prio && l.op !== "neg") {
        leftmost = { node: l, path: [...curPath, 0] };
        cur = l;
        curPath = [...curPath, 0];
      } else {
        items.unshift({ node: l, path: [...curPath, 0] });
        break;
      }
    }
    if (items.every((it) => isNum(it.node))) out.push(leftmost);
    else items.forEach((it) => walk(it.node, it.path));
  };
  walk(root, []);
  return out;
}

function replaceAt(root: Node, path: number[], value: number): Node {
  if (!path.length) return { type: "num", value };
  const [i, ...rest] = path;
  if (root.type === "num") return root;
  const args = root.args.map((a, k) => (k === i ? replaceAt(a, rest, value) : a));
  return root.type === "fn" ? { ...root, args } : { ...root, args };
}

export interface OrderVerdict {
  /** the student's line is reachable by legal steps */
  inOrder: boolean;
  /** what the method says to do first from the previous line, e.g. "30−19=11" */
  expectedFirst?: string;
  /** we could not analyse (variables, unsupported ops) – caller should not judge */
  unknown?: boolean;
}

const MAX_STATES = 4000;

/** Is `studentLine` reachable from `prevLine` by legal (in-order) evaluation steps? */
export function checkOrder(prevLine: string, studentLine: string): OrderVerdict {
  const p = parseExpr(prevLine),
    s = parseExpr(studentLine);
  if (!p || !s) return { inOrder: true, unknown: true };
  const pn = fromMath(p),
    sn = fromMath(s);
  if (!pn || !sn) return { inOrder: true, unknown: true };
  const target = key(canon(sn));
  const start = canon(pn);
  const first = legalSteps(start);
  const expectedFirst = first.length ? describe(first[0].node) : undefined;
  const seen = new Set<string>([key(start)]);
  const queue: Node[] = [start];
  while (queue.length && seen.size < MAX_STATES) {
    const cur = queue.shift()!;
    for (const st of legalSteps(cur)) {
      const v = evalOp(st.node);
      if (v === null || !Number.isFinite(v)) continue;
      const nxt = canon(replaceAt(cur, st.path, v));
      const k = key(nxt);
      if (k === target) return { inOrder: true, expectedFirst };
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(nxt);
      }
    }
  }
  return { inOrder: false, expectedFirst };
}

/** true if the expression is purely numeric (no variables) – the only case we judge order for */
export function isNumericLine(line: string): boolean {
  const n = parseExpr(line);
  if (!n) return false;
  let ok = true;
  n.traverse((x) => {
    if (x.type === "SymbolNode") {
      const name = (x as unknown as { name: string }).name;
      if (!["sqrt", "nthRoot", "abs"].includes(name)) ok = false;
    }
  });
  return ok;
}

