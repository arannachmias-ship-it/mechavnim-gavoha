/**
 * 🧱 סוגריים "שטוחים" מול סוגריים כגוש.
 *
 * מקשי המקלדת שלנו מכניסים "(" ו-")" כתווים בודדים, ולא כזוג מובנה
 * (\left(…\right)) כמו שנוצר בהקלדה במקלדת פיזית. ל-MathLive זה משנה:
 * כשמבקשים ממנו שבר, הוא לוקח כמונה את "מה שלפני הסמן" – ובלי גוש מובנה
 * הוא חוצה את הסוגריים באמצע. ככה (x-2)(x-5) הפך אצל נגה ל-(x-\frac{2)(x-5)}{□}.
 *
 * לכן, רגע לפני שמקש ÷ פועל, מסדרים את הסוגריים לזוגות מובנים – וכל השורה
 * נכנסת למונה כמו שצריך. המרה נעשית רק כשהסוגריים מאוזנים, ורק כשהסמן בסוף.
 */

/** המחלקה שמסמנת את מקש השבר בפריסת המקלדת שלנו */
export const FRAC_KEY_CLASS = "key-frac";

export function isFracKey(el: Element | EventTarget | null): boolean {
  const node = el as Element | null;
  return !!(node && typeof node.closest === "function" && node.closest(`.${FRAC_KEY_CLASS}`));
}

/** ( ) בודדים → \left( \right). מחזיר את המקור אם הסוגריים לא מאוזנים. */
export function normalizeFences(latex: string): string {
  if (!latex.includes("(") && !latex.includes(")")) return latex;
  const out: string[] = [];
  let depth = 0;
  let changed = false;
  let i = 0;
  while (i < latex.length) {
    if (latex.startsWith("\\left", i) || latex.startsWith("\\right", i)) {
      const kw = latex.startsWith("\\left", i) ? "\\left" : "\\right";
      i += kw.length;
      let fence = "";
      while (i < latex.length && /\s/.test(latex[i])) fence += latex[i++];
      if (latex[i] === "\\") fence += latex[i++]; // \{ \| וכו'
      if (i < latex.length) fence += latex[i++];
      if (fence.trim() === "(") depth++;
      if (fence.trim() === ")") depth--;
      if (depth < 0) return latex;
      out.push(kw + fence);
      continue;
    }
    const c = latex[i];
    if (c === "\\") {
      // פקודה – מעתיקים אותה שלמה כדי לא להתבלבל מתו שאחריה
      let cmd = c + (latex[i + 1] ?? "");
      i += 2;
      while (i < latex.length && /[a-zA-Z]/.test(latex[i]) && /[a-zA-Z]/.test(cmd[1])) cmd += latex[i++];
      out.push(cmd);
      continue;
    }
    if (c === "(") {
      depth++;
      out.push("\\left(");
      changed = true;
    } else if (c === ")") {
      depth--;
      if (depth < 0) return latex;
      out.push("\\right)");
      changed = true;
    } else out.push(c);
    i++;
  }
  if (depth !== 0) return latex;
  return changed ? out.join("") : latex;
}

/** מה שצריך מ-MathfieldElement כדי להכין שבר – מוגדר בנפרד כדי שיהיה אפשר לבדוק */
export interface FenceTarget {
  getValue: (format: "latex") => string;
  setValue: (latex: string, options?: unknown) => void;
  position: number;
  lastOffset: number;
  selectionIsCollapsed?: boolean;
}

/**
 * רגע לפני שמקש ÷ מכניס \frac{#@}{#?} – מסדרים סוגריים, אבל רק כשזה בטוח:
 * סמן יחיד בסוף השורה (בעריכה באמצע לא נוגעים, כדי לא להזיז לה את הסמן).
 * מחזיר true אם באמת שינינו משהו.
 */
export function prepareFraction(mf: FenceTarget): boolean {
  try {
    if (mf.selectionIsCollapsed === false) return false;
    if (mf.position !== mf.lastOffset) return false;
    const v = mf.getValue("latex");
    const n = normalizeFences(v);
    if (n === v) return false;
    mf.setValue(n, { selectionMode: "after", suppressChangeNotifications: true });
    return true;
  } catch {
    return false;
  }
}
