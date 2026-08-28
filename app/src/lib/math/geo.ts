/**
 * בודק השורות של פונקציות וגאומטריה אנליטית (kind = "geo").
 *
 * הרעיון: לתרגיל יש רשימת "בקשות" (asks) – ערכים (m=2), נקודות ((3,0)) ומשוואה של גרף (y=2x+1).
 * כל שורה שנגה כותבת נבדקת אם היא **נכונה בעולם של התרגיל**: שורת ביניים כמו m=(7-3)/(3-1) או
 * 3=2·1+b מתקבלת אם היא מתקיימת עם הערכים האמיתיים; שורה שפותרת בקשה מסמנת אותה כ"נמצאה".
 * כשכל הבקשות נמצאו – התרגיל הסתיים.
 */
import type { MathNode } from "mathjs";
import { parseExpr, normalizeInput, nodeVars, solutionSet } from "./check";
import type { Exercise, CheckResult, GeoAsk } from "./types";

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol * Math.max(1, Math.abs(a), Math.abs(b));

/** ניקוי ראשוני: עברית, f(x) → y, \left/\right, רווחים */
function pre(raw: string): string {
  return raw
    .replace(/או/g, ",")
    .replace(/[֐-׿]/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\(?:quad|qquad|,|;|!)/g, "")
    .replace(/f\s*\(\s*x\s*\)/g, "y")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/([A-Z])([A-Z])(?![A-Za-z])/g, (_, p, q) => segKey(p + q))
    .trim();
}
/** "AB" (אורך קטע) → שם משתנה שהמנתח שומר כמו שהוא (q + קודים) */
export function segKey(seg: string): string {
  return "q" + [...seg].map((c) => c.charCodeAt(0) - 55).join("");
}

/** מספר מתוך טקסט (מותר \frac, שורש, סוגריים) – בלי משתנים */
function numOf(s: string): number | null {
  if (!s) return null;
  const node = parseExpr(s);
  if (!node) return null;
  if (nodeVars(node).length) return null;
  try {
    const v = node.evaluate({});
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** מוצא נקודות "(a,b)" בטקסט. מחזיר את הנקודות ואת מה שנשאר מסביבן (תוויות, פסיקים, "=") */
export function extractPoints(s: string): { points: { x: number; y: number }[]; rest: string } | null {
  const points: { x: number; y: number }[] = [];
  let rest = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "(") {
      // find matching paren, top-level comma
      let depth = 0,
        j = i,
        comma = -1;
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === "(" || c === "{") depth++;
        else if (c === ")" || c === "}") depth--;
        else if (c === "," && depth === 1) comma = comma === -1 ? j : -2;
        if (depth === 0) break;
      }
      if (j >= s.length) return null;
      if (comma > 0) {
        const xs = s.slice(i + 1, comma),
          ys = s.slice(comma + 1, j);
        const x = numOf(xs),
          y = numOf(ys);
        if (x === null || y === null) return null;
        points.push({ x, y });
        i = j + 1;
        continue;
      }
      rest += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    rest += s[i];
    i++;
  }
  if (!points.length) return null;
  // what remains may only be labels/punctuation: "A=", ",", "M", "V=" …
  if (!/^[A-Za-z=,;]*$/.test(rest)) return null;
  return { points, rest };
}

/* ---------- מצב: אילו בקשות כבר נמצאו ---------- */
export interface GeoState {
  resolved: Set<string>;
  /**
   * קואורדינטות בודדות שנכתבו בשורות נפרדות. נגה כותבת לפעמים "y=12" בשורה אחת
   * ו-"x=0" בשורה הבאה במקום "(0,12)" – וזו תשובה שלמה לכל דבר, אז אוספים אותן
   * ומסמנים את הנקודה כשנמצאו שתיהן.
   */
  xs?: number[];
  ys?: number[];
}

function asksOf(ex: Exercise): GeoAsk[] {
  return ex.asks ?? [];
}

/** סביבות דגימה: הערכים הידועים, ועבור x,y – נקודות על הגרף / הנקודות המבוקשות */
function envs(ex: Exercise, useXY: boolean): Record<string, number>[] {
  const base: Record<string, number> = { ...(ex.params ?? {}) };
  for (const a of asksOf(ex)) if (a.kind === "value" && typeof a.value === "number") base[a.key] = a.value;
  if (!useXY) return [base];
  const out: Record<string, number>[] = [];
  if (ex.curve) {
    for (const x of [-1.7, 0.6, 1.9, 3.3]) out.push({ ...base, x, y: curveY(ex, x) });
  }
  return out;
}
function pointEnvs(ex: Exercise): Record<string, number>[] {
  const base: Record<string, number> = { ...(ex.params ?? {}) };
  for (const a of asksOf(ex)) if (a.kind === "value" && typeof a.value === "number") base[a.key] = a.value;
  return asksOf(ex)
    .filter((a) => a.kind === "point")
    .map((a) => ({ ...base, x: a.x!, y: a.y! }));
}
function curveY(ex: Exercise, x: number): number {
  const c = ex.curve!;
  if (c.kind === "line") return c.coeffs[0] * x + c.coeffs[1];
  return c.coeffs[0] * x * x + c.coeffs[1] * x + c.coeffs[2];
}
function evalNode(n: MathNode, env: Record<string, number>): number | null {
  try {
    const v = n.evaluate(env);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
function holds(nodes: MathNode[], env: Record<string, number>): boolean {
  const vals = nodes.map((n) => evalNode(n, env));
  if (vals.some((v) => v === null)) return false;
  return vals.every((v) => near(v!, vals[0]!, 1e-6));
}

type LineOutcome =
  | { kind: "resolve"; keys: string[]; message?: string; mistake?: string }
  | { kind: "ok"; message?: string; mistake?: string; warn?: string }
  | { kind: "wrong"; message: string; mistake?: string }
  | { kind: "unparsable"; message: string }
  | { kind: "same" };

function askLabel(a: GeoAsk) {
  return a.label;
}
function nextAsk(ex: Exercise, st: GeoState): GeoAsk | undefined {
  return asksOf(ex).find((a) => !st.resolved.has(a.key));
}
/** שבר פשוט כטקסט: -1/3 */
function fracText(n: number): string {
  for (let d = 1; d <= 24; d++) {
    const num = Math.round(n * d);
    if (Math.abs(num / d - n) < 1e-9) return d === 1 ? String(num) : `${num}/${d}`;
  }
  return fmt(n);
}
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

/** מטפל בנקודה/נקודות שנכתבו */
function handlePoints(ex: Exercise, st: GeoState, pts: { x: number; y: number }[]): LineOutcome {
  const asks = asksOf(ex).filter((a) => a.kind === "point");
  const keys: string[] = [];
  for (const p of pts) {
    const matches = asks.filter((a) => near(a.x!, p.x) && near(a.y!, p.y));
    if (matches.length) {
      // אותה נקודה יכולה לענות על שתי בקשות (למשל קודקוד שיושב על ציר y) – מסמנים את כולן
      for (const m of matches) if (!st.resolved.has(m.key) && !keys.includes(m.key)) keys.push(m.key);
      continue;
    }
    // traps
    const trap = (ex.geoTraps ?? []).find((t) => t.key === "point" && typeof t.x === "number" && near(t.x, p.x) && near(t.y ?? NaN, p.y));
    if (trap) return { kind: "wrong", message: trap.message, mistake: trap.mistake ?? "point" };
    const swapped = asks.find((a) => near(a.x!, p.y) && near(a.y!, p.x) && !near(a.x!, a.y!));
    if (swapped) return { kind: "wrong", message: `הפכת בין x ל-y. בנקודה קודם כותבים כמה צעדים (x) ואז כמה קומות (y): (x, y).`, mistake: "axis_mix" };
    if (ex.curve && near(curveY(ex, p.x), p.y, 1e-4)) return { kind: "wrong", message: `הנקודה (${fmt(p.x)}, ${fmt(p.y)}) באמת על הגרף – אבל זו לא הנקודה ששאלנו עליה. קראי שוב מה מבקשים.`, mistake: "point" };
    return { kind: "wrong", message: `הנקודה (${fmt(p.x)}, ${fmt(p.y)}) לא נכונה. הציבי אותה חזרה ותראי שזה לא מסתדר.`, mistake: "point" };
  }
  if (!keys.length) return { kind: "same" };
  return { kind: "resolve", keys };
}

/** k = value */
function handleAssign(ex: Exercise, st: GeoState, k: string, value: number, chainOk: boolean): LineOutcome {
  const asks = asksOf(ex);
  const valAsk = asks.find((a) => a.kind === "value" && a.key === k);
  if (valAsk) {
    const approx = !near(valAsk.value!, value) && Math.abs(valAsk.value! - value) < 0.006;
    if (near(valAsk.value!, value) || approx) {
      if (!chainOk && !approx) return { kind: "wrong", message: `${k} באמת יוצא ${fmt(value)}, אבל החישוב שכתבת באמצע לא נותן את זה. בדקי את השורה.` };
      if (st.resolved.has(k)) return { kind: "same" };
      return { kind: "resolve", keys: [k], message: approx ? `מתקבל – אבל ${fmt(value)} זה עיגול. בבגרות כותבים את השבר המדויק (${fracText(valAsk.value!)}).` : undefined };
    }
    const trap = (ex.geoTraps ?? []).find((t) => t.key === k && typeof t.value === "number" && near(t.value, value, 1e-3));
    if (trap) return { kind: "wrong", message: trap.message, mistake: trap.mistake ?? "geo" };
    if (near(-valAsk.value!, value)) return { kind: "wrong", message: `${k} יוצא עם הסימן ההפוך. בדקי מי מחסרים ממי – ${valAsk.label}.`, mistake: "sign" };
    return { kind: "wrong", message: `${k} לא יוצא ${fmt(value)}. ${valAsk.label} – בדקי שוב את ההצבה.`, mistake: "geo" };
  }
  if (k === "x" || k === "y") {
    const pts = asks.filter((a) => a.kind === "point");
    const hit = pts.find((a) => near(k === "x" ? a.x! : a.y!, value));
    if (hit) {
      if (!chainOk) return { kind: "wrong", message: `${k}=${fmt(value)} נכון, אבל החישוב באמצע לא נותן את זה. בדקי.` };
      // זוכרים את הקואורדינטה; אם יחד עם קודמת היא משלימה נקודה שביקשנו – סימנו אותה
      const bag = k === "x" ? (st.xs ??= []) : (st.ys ??= []);
      if (!bag.some((c) => near(c, value))) bag.push(value);
      const complete = pts.find((a) => !st.resolved.has(a.key) && (st.xs ?? []).some((x) => near(x, a.x!)) && (st.ys ?? []).some((y) => near(y, a.y!)));
      if (complete) return { kind: "resolve", keys: [complete.key], message: `יחד עם מה שכתבת קודם זו הנקודה (${fmt(complete.x!)}, ${fmt(complete.y!)}).` };
      const other = k === "x" ? "y" : "x";
      return { kind: "ok", message: st.resolved.has(hit.key) ? "נכון." : `${k}=${fmt(value)} – נכון. עכשיו ה-${other} שלה: או בשורה נפרדת, או כנקודה שלמה (x, y).` };
    }
    // maybe a coordinate of a point on the curve for an axis intersection ask? generic wrong
    const trap = (ex.geoTraps ?? []).find((t) => t.key === k && typeof t.value === "number" && near(t.value, value, 1e-3));
    if (trap) return { kind: "wrong", message: trap.message, mistake: trap.mistake ?? "geo" };
    return { kind: "wrong", message: `${k}=${fmt(value)} לא מסתדר עם התרגיל. הציבי חזרה ובדקי.`, mistake: "geo" };
  }
  if (ex.params && k in ex.params) {
    if (near(ex.params[k], value)) {
      if (!chainOk) return { kind: "wrong", message: `${k} באמת ${fmt(value)}, אבל החישוב שכתבת לא נותן את זה.` };
      // "AB=5" כשביקשנו d=5 – זה אותו דבר
      const aliasKey = ex.aliases?.[k];
      const alias = aliasKey ? asks.find((a) => a.key === aliasKey && a.kind === "value" && !st.resolved.has(a.key) && near(a.value!, value)) : undefined;
      if (alias) return { kind: "resolve", keys: [alias.key] };
      return { kind: "ok", message: "נכון, ממשיכים." };
    }
    const trap = (ex.geoTraps ?? []).find((t) => t.key === k && typeof t.value === "number" && near(t.value, value, 1e-3));
    if (trap) return { kind: "wrong", message: trap.message, mistake: trap.mistake ?? "geo" };
    return { kind: "wrong", message: `${k} לא יוצא ${fmt(value)}. בדקי את ההצבה.`, mistake: "geo" };
  }
  return { kind: "unparsable", message: `האות ${k} לא מוכרת בתרגיל הזה. השתמשי באותיות של השאלה (למשל m, b, x, y).` };
}

/** משוואה כללית (עם x,y או בלי) */
function handleEquation(ex: Exercise, st: GeoState, segs: string[]): LineOutcome {
  const nodes = segs.map((s) => parseExpr(s));
  if (nodes.some((n) => !n)) return { kind: "unparsable", message: "לא הצלחתי לקרוא את השורה. בדקי סוגריים וסימנים." };
  const ns = nodes as MathNode[];
  const vars = new Set(ns.flatMap((n) => nodeVars(n)));
  const known = new Set(Object.keys(envs(ex, false)[0]));
  const usesXY = vars.has("x") || vars.has("y");
  const unknown = [...vars].filter((v) => v !== "x" && v !== "y" && !known.has(v));
  if (unknown.length) return { kind: "unparsable", message: `האות ${unknown[0]} לא מוכרת בתרגיל הזה. השתמשי באותיות של השאלה.` };
  if (!usesXY) {
    const env = envs(ex, false)[0];
    if (holds(ns, env)) return { kind: "ok", message: "נכון, ממשיכים." };
    return { kind: "wrong", message: "השורה הזאת לא מסתדרת עם הנתונים. הציבי שוב – ובדקי סימנים." , mistake: "geo" };
  }
  // equation with x / y
  const onlyXY = [...vars].every((v) => v === "x" || v === "y");
  if (ex.curve) {
    const es = envs(ex, true);
    if (es.length && es.every((e) => holds(ns, e))) {
      // is it the curve equation itself, in the form y = f(x)? (not an identity)
      const yForm = segs.length === 2 && normalizeInput(segs[0]) === "y" && !nodeVars(ns[1]).includes("y");
      if (onlyXY && yForm && vars.has("x")) {
        const off = { x: 0.6, y: curveY(ex, 0.6) + 1 };
        if (!holds(ns, off)) {
          const eqAsk = asksOf(ex).find((a) => a.kind === "eq");
          if (eqAsk) return st.resolved.has(eqAsk.key) ? { kind: "same" } : { kind: "resolve", keys: [eqAsk.key] };
        }
      }
      const eqOpen = asksOf(ex).some((a) => a.kind === "eq" && !st.resolved.has(a.key));
      return { kind: "ok", message: eqOpen && onlyXY && !yForm ? "נכון – זה הישר, אבל כתבי אותו בצורה y=mx+b (y לבד בצד שמאל)." : "נכון, ממשיכים." };
    }
  }
  const pes = pointEnvs(ex);
  if (pes.length && pes.every((e) => holds(ns, e))) return { kind: "ok", message: "נכון, ממשיכים." };
  // x-only equation whose roots are the asked x's
  if (onlyXY && !vars.has("y") && segs.length === 2) {
    const ss = solutionSet(`${segs[0]}=${segs[1]}`, "x");
    const xs = asksOf(ex).filter((a) => a.kind === "point").map((a) => a.x!);
    if (ss.kind === "finite" && ss.roots.length && ss.roots.every((r) => xs.some((x) => near(x, r)))) return { kind: "ok", message: "נכון – מכאן יוצאים ה-x-ים." };
  }
  // trap: line equation with wrong slope etc. – generic
  if (ex.curve && ex.curve.kind === "line" && onlyXY) return { kind: "wrong", message: "זו לא המשוואה של הישר הזה. בדקי: השיפוע (קומות על כל צעד) ואיפה נכנסים לבניין (b). הציבי את הנקודות ותראי אם זה מסתדר.", mistake: "geo" };
  if (ex.curve && ex.curve.kind === "parabola" && onlyXY) return { kind: "wrong", message: "זו לא המשוואה של הפרבולה הזאת. הציבי נקודה ובדקי.", mistake: "geo" };
  return { kind: "wrong", message: "השורה הזאת לא מסתדרת עם הנתונים של התרגיל. הציבי את הנקודות/הערכים ובדקי.", mistake: "geo" };
}

/** בודק שורה אחת מול מצב נתון */
export function geoLine(ex: Exercise, st: GeoState, raw: string): LineOutcome {
  const s = pre(raw);
  if (!s) return { kind: "unparsable", message: "כתבי משהו קודם 🙂" };
  // 1. נקודות
  const pts = extractPoints(s);
  if (pts) return handlePoints(ex, st, pts.points);
  // 2. מספר בודד – התשובה לבקשה היחידה שנשארה
  if (!/[a-zA-Z=]/.test(s.replace(/\\[a-zA-Z]+/g, "").replace(/sqrt/g, ""))) {
    const v = numOf(s);
    if (v === null) return { kind: "unparsable", message: "לא הצלחתי לקרוא את המספר." };
    const open = asksOf(ex).filter((a) => a.kind === "value" && !st.resolved.has(a.key));
    const hits = open.filter((a) => near(a.value!, v));
    if (hits.length === 1) return { kind: "resolve", keys: [hits[0].key] };
    if (hits.length > 1) return { kind: "ok", message: "נכון – אבל כתבי עם האות, שנדע למה התכוונת (למשל m=…)." };
    if (open.length === 1) {
      const a = open[0];
      const trap = (ex.geoTraps ?? []).find((t) => t.key === a.key && typeof t.value === "number" && near(t.value, v, 1e-3));
      if (trap) return { kind: "wrong", message: trap.message, mistake: trap.mistake ?? "geo" };
      return { kind: "wrong", message: `${a.label} לא יוצא ${fmt(v)}. בדקי שוב.`, mistake: "geo" };
    }
    return { kind: "wrong", message: "המספר הזה לא מתאים לאף אחד מהדברים שביקשנו. כתבי עם האות (למשל m=…, d=…)." };
  }
  // 3. שורה עם "=" – אולי כמה השמות "x=1, x=3"
  if (!s.includes("=")) {
    // ביטוי בלי שוויון – ננסה לראות אם הוא שווה לבקשה כלשהי
    const v = numOf(s);
    if (v !== null) return geoLine(ex, st, String(v));
    return { kind: "unparsable", message: "כתבי שוויון (למשל m=… או y=…) או נקודה (x, y)." };
  }
  const parts = s.split(/,|;/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => p.includes("="))) {
    // sequential
    const keys: string[] = [];
    const tmp: GeoState = { resolved: new Set(st.resolved), xs: [...(st.xs ?? [])], ys: [...(st.ys ?? [])] };
    let lastMsg: string | undefined;
    for (const p of parts) {
      const o = geoLine(ex, tmp, p);
      if (o.kind === "wrong" || o.kind === "unparsable") return o;
      if (o.kind === "resolve") {
        keys.push(...o.keys);
        o.keys.forEach((k) => tmp.resolved.add(k));
      }
      if (o.kind === "ok") lastMsg = o.message;
    }
    if (keys.length) return { kind: "resolve", keys };
    return { kind: "ok", message: lastMsg ?? "נכון, ממשיכים." };
  }
  const segs = s.split("=").filter(Boolean);
  if (segs.length < 2) return { kind: "unparsable", message: "חסר צד אחד לשוויון." };
  const nodes = segs.map((x) => parseExpr(x));
  if (nodes.some((n) => !n)) return { kind: "unparsable", message: "לא הצלחתי לקרוא את השורה. בדקי סוגריים וסימנים." };
  const constSeg = segs.map((x, i) => ({ i, v: nodeVars(nodes[i]!).length ? null : evalNode(nodes[i]!, {}) })).filter((c) => c.v !== null);
  const symSeg = segs.findIndex((x) => /^[a-zA-Z]\d*$/.test(normalizeInput(x)));
  if (symSeg >= 0 && constSeg.length) {
    const k = normalizeInput(segs[symSeg]);
    const value = constSeg[constSeg.length - 1].v!;
    // chain consistency: all segments equal under env with k=value
    const env = { ...envs(ex, false)[0], [k]: value };
    let chainOk = holds(nodes as MathNode[], env);
    if (!chainOk && (k === "x" || k === "y")) {
      // for x/y assignments the other coordinate may appear – check on point envs
      chainOk = pointEnvs(ex).some((e) => holds(nodes as MathNode[], { ...e, [k]: value }));
    }
    return handleAssign(ex, st, k, value, chainOk || segs.length === 2);
  }
  return handleEquation(ex, st, segs);
}

/** משחזר את המצב מההיסטוריה (השורות שהתקבלו) */
export function geoState(ex: Exercise, history: string[]): GeoState {
  const st: GeoState = { resolved: new Set() };
  for (const h of history) {
    const o = geoLine(ex, st, h);
    if (o.kind === "resolve") o.keys.forEach((k) => st.resolved.add(k));
  }
  return st;
}

/** רשימת המשימות של התרגיל עם סימון מה כבר נמצא – לתצוגה */
export function geoChecklist(ex: Exercise, history: string[]): { key: string; label: string; done: boolean }[] {
  const st = geoState(ex, history);
  return asksOf(ex).map((a) => ({ key: a.key, label: a.label, done: st.resolved.has(a.key) }));
}

export function checkGeo(ex: Exercise, history: string[], rawInput: string): CheckResult {
  const st = geoState(ex, history);
  const stageOfState = (s: GeoState) => Math.min(s.resolved.size, Math.max(0, ex.stages.length - 1));
  const prev = history.length ? pre(history[history.length - 1]) : "";
  if (prev && prev === pre(rawInput)) return { status: "same", message: "זו אותה שורה. תתקדמי צעד.", stage: stageOfState(st) };
  const o = geoLine(ex, st, rawInput);
  if (o.kind === "unparsable") return { status: "unparsable", message: o.message, stage: stageOfState(st) };
  if (o.kind === "wrong") return { status: "wrong", message: o.message, stage: stageOfState(st), mistake: o.mistake ?? "geo" };
  if (o.kind === "same") return { status: "same", message: "את זה כבר מצאת. הלאה – מה עוד ביקשנו?", stage: stageOfState(st) };
  if (o.kind === "ok") return { status: "ok", message: o.message ?? "נכון, ממשיכים.", stage: stageOfState(st), mistake: o.mistake, warn: o.warn };
  // resolve
  const after: GeoState = { resolved: new Set([...st.resolved, ...o.keys]) };
  const all = asksOf(ex).every((a) => after.resolved.has(a.key));
  const found = o.keys.map((k) => asksOf(ex).find((a) => a.key === k)!).map(askLabel).join(", ");
  const note = o.message ? ` ${o.message}` : "";
  if (all) return { status: "done", message: `${found} – נכון.${note} זהו, הכול נמצא. ✔`, stage: ex.stages.length };
  const nx = nextAsk(ex, after);
  return { status: "ok", message: `${found} – נכון.${note} עכשיו: ${nx ? nx.label : ""}.`, stage: stageOfState(after) };
}
