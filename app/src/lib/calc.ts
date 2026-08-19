/**
 * המחשבון של האפליקציה – החישוב עצמו (בלי UI), כדי שאפשר יהיה לבדוק אותו.
 * מקבל את הטקסט שנגה הקלידה (עם × ÷ √ ² ^ סוגריים) ומחזיר תוצאה, וגם שבר פשוט אם יש.
 */
import { parseExpr, nodeVars } from "./math/check";

export interface CalcResult {
  ok: boolean;
  value?: number;
  /** תצוגה מעוגלת (עד 10 ספרות משמעותיות) */
  text?: string;
  /** אם התוצאה היא שבר פשוט – למשל "3/4" */
  frac?: string;
  error?: string;
}

/** ניקוי לפני חישוב: √ בלי סוגריים → sqrt(...) על המספר/הסוגריים שאחריו */
function prep(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  // √25 → sqrt(25), √(…) → sqrt(…) — normalizeInput כבר יודע √ → sqrt אבל בלי סוגריים mathjs לא מבין "sqrt25"
  s = s.replace(/√\s*(\d+(?:\.\d+)?)/g, "sqrt($1)");
  // איזון סוגריים שנשארו פתוחים – סוגרים בשקט (כמו במחשבונים אמיתיים)
  const open = (s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length;
  if (open > 0) s += ")".repeat(open);
  return s;
}

export function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  const r = Number(v.toPrecision(10));
  return String(r);
}

export function asFraction(v: number): string | undefined {
  if (!Number.isFinite(v) || Number.isInteger(v)) return undefined;
  for (let d = 2; d <= 64; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9) return `${n}/${d}`;
  }
  return undefined;
}

export function evalCalc(raw: string): CalcResult {
  const s = prep(raw);
  if (!s) return { ok: false, error: "" };
  const node = parseExpr(s);
  if (!node) return { ok: false, error: "לא הצלחתי לקרוא – בדקי סוגריים וסימנים" };
  if (nodeVars(node).length) return { ok: false, error: "המחשבון עובד רק עם מספרים (בלי x)" };
  try {
    const v = node.evaluate({});
    if (typeof v !== "number") return { ok: false, error: "לא יצא מספר" };
    if (!Number.isFinite(v)) return { ok: false, error: "אי אפשר – חלוקה באפס?" };
    return { ok: true, value: v, text: fmtNumber(v), frac: asFraction(v) };
  } catch {
    return { ok: false, error: "לא הצלחתי לחשב" };
  }
}
