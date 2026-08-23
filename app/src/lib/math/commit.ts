/**
 * מתי "change" של MathLive באמת אומר "בדקי לי את השורה".
 *
 * MathLive יורה change גם על לחיצה מכוונת על ↵ וגם סתם כשהשדה מאבד פוקוס –
 * וגם לחיצה על כפתור באפליקציה (מחשבון, רמז, השיטה) מוציאה את הפוקוס מהשדה.
 * בלי השער הזה, נגה פותחת את המחשבון באמצע תרגיל והשורה החלקית נבדקת ונרשמת כטעות.
 * לכן שולחים רק כשיש כוונה מפורשת: מקש ה-↵ של המקלדת, או שדה שנשאר ממוקד.
 */

/** כמה זמן אחרי לחיצה על ↵ עוד מקבלים את ה-change שהיא גררה */
export const COMMIT_INTENT_MS = 1500;

/** המחלקה שמסמנת את מקש ה-↵ בפריסת המקלדת שלנו */
export const COMMIT_KEY_CLASS = "key-commit";

export function isCommitKey(el: Element | EventTarget | null): boolean {
  const node = el as Element | null;
  return !!(node && typeof node.closest === "function" && node.closest(`.${COMMIT_KEY_CLASS}`));
}

export function isIntentionalCommit(o: { intentAt: number; now: number; hidden: boolean; focused: boolean }): boolean {
  // המסך ברקע (יצאה לוואטסאפ/למחשבון של הטלפון) – אף פעם לא שליחה
  if (o.hidden) return false;
  // השדה עדיין ממוקד ⇒ אף כפתור לא גנב את הפוקוס, זאת לחיצה על ↵
  if (o.focused) return true;
  if (!o.intentAt) return false;
  const dt = o.now - o.intentAt;
  return dt >= 0 && dt <= COMMIT_INTENT_MS;
}
