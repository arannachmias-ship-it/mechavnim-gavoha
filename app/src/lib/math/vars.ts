/**
 * אילו אותיות (נעלמים) מופיעות בתרגיל – כדי שהמקלדת המתמטית תכיל תמיד
 * בדיוק את האותיות שנגה צריכה. בלי זה קרה שתרגיל עם n הופיע ובמקלדת לא היה n.
 */
import type { Exercise } from "./types";

/** מנקה פקודות LaTeX ומחזיר את האותיות הבודדות שנשארו */
export function lettersIn(latex: string): string[] {
  const s = latex
    .replace(/\\text\{[^}]*\}/g, " ")
    .replace(/\\operatorname\{[^}]*\}/g, " ")
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[֐-׿]+/g, " "); // עברית
  return [...new Set(s.match(/[a-zA-Z]/g) ?? [])];
}

/** כל הנעלמים של תרגיל – מהשאלה, מהשלבים, מהתשובה ומהשדות המפורשים */
export function exerciseVariables(ex: Exercise): string[] {
  const parts = [ex.promptLatex, ex.finalLatex, ...(ex.steps ?? []).map((s) => s.latex)];
  const found = new Set<string>();
  for (const p of parts) if (p) for (const c of lettersIn(p)) found.add(c);
  if (ex.variable) found.add(ex.variable);
  for (const v of ex.vars ?? []) found.add(v);
  return [...found];
}

/** ברירת המחדל של האותיות במקלדת (בסדר שכיחות), אחרי אלה שהתרגיל דורש */
export const DEFAULT_KEYBOARD_VARS = ["x", "y", "a", "b", "t", "m", "n", "c", "k", "p", "q", "z"];
/** כמה מקשי-אות יש בפריסת המקלדת */
export const KEYBOARD_VAR_SLOTS = 6;

/**
 * האותיות שיופיעו על המקלדת: קודם אלה שבתרגיל (מובטח!), אחר כך מילוי מהרשימה הקבועה.
 * אם התרגיל דורש יותר אותיות ממספר המשבצות – מרחיבים, כדי שלעולם לא תיחסר אות.
 */
export function keyboardVariables(exerciseVars: string[] = []): string[] {
  const out: string[] = [];
  for (const v of exerciseVars) if (/^[a-zA-Z]$/.test(v) && !out.includes(v)) out.push(v);
  for (const v of DEFAULT_KEYBOARD_VARS) {
    if (out.length >= KEYBOARD_VAR_SLOTS) break;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
