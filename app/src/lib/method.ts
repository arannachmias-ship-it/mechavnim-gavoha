import type { Summary } from "@/lib/progress";

/**
 * בכניסה ראשונה לנושא דוחפים את השיטה: נגה מגיעה מהתוכנית ישר לתרגיל,
 * ובלי זה היא פוגשת את התרגיל הראשון בנושא בלי לראות את ההסבר והדוגמה.
 * פעם אחת לנושא – ברגע שיש ולו ניסיון אחד, או שכבר הצגנו, לא דוחפים שוב.
 */
export function shouldPushMethod(opts: { summary: Summary | null; topicId?: string; isCustom?: boolean; alreadySeen?: boolean }): boolean {
  const { summary, topicId, isCustom = false, alreadySeen = false } = opts;
  if (isCustom || alreadySeen || !summary || !topicId) return false;
  return (summary.topics[topicId]?.attempts ?? 0) === 0;
}
