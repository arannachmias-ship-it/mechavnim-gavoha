import type { Plan } from "./plan";

/**
 * 🎯 "המשימה של היום" + מוכנות למבחן – החישובים של מסך הבית של נגה
 * ושל הפולס במסך ההורה. טהור, בלי DB – כדי שאפשר לבדוק ביחידה.
 */

export interface Mission {
  state: "disabled" | "exam_passed" | "off" | "empty" | "open" | "done";
  targetEx: number;
  doneEx: number;
  remainEx: number;
  remainMinutes: number;
  /** 0..1 – התקדמות היום */
  pct: number;
  /** לאן מוביל הכפתור הראשי */
  firstOpenTypeId: string | null;
}

export function missionOf(p: Plan): Mission {
  const targetEx = p.todayTasks.reduce((s, t) => s + t.exercises, 0);
  const doneEx = p.todayTasks.reduce((s, t) => s + Math.min(t.done, t.exercises), 0);
  const remainEx = Math.max(0, targetEx - doneEx);
  const remainMinutes = Math.ceil(remainEx * p.avgMinPerEx);
  const firstOpen = p.todayTasks.find((t) => t.done < t.exercises);
  const base = {
    targetEx,
    doneEx,
    remainEx,
    remainMinutes,
    pct: targetEx > 0 ? Math.min(1, doneEx / targetEx) : 0,
    firstOpenTypeId: firstOpen?.typeId ?? null,
  };
  if (p.status === "disabled") return { ...base, state: "disabled" };
  if (p.status === "exam_passed") return { ...base, state: "exam_passed" };
  if (p.days[0]?.off) return { ...base, state: "off" };
  if (targetEx === 0) return { ...base, state: "empty" };
  if (doneEx >= targetEx) return { ...base, state: "done", pct: 1 };
  return { ...base, state: "open" };
}

/**
 * מוכנות למבחן כאחוז אחד, 0..100.
 * סוג "מוכן" = 1; כל השאר לפי ה-mastery ביחס לרף (0.8), עם תקרה 0.9 –
 * כדי שהצעד האחרון לאחוז המלא יעבור תמיד דרך "מוכן" אמיתי (כוכביים/רצף הצלחות),
 * לא דרך גרירת ה-mastery. סוג חדש = 0.
 */
export function examReadinessPercent(p: Plan): number {
  if (!p.needs.length) return 0;
  const score = p.needs.reduce((s, n) => s + (n.readiness === "ready" ? 1 : Math.min(0.9, n.mastery / 0.8)), 0);
  return Math.round((score / p.needs.length) * 100);
}

/** שם קצר לנושא של המשימה הפתוחה הראשונה (לכפתור/להודעה) */
export function firstOpenTitle(p: Plan): string | null {
  const t = p.todayTasks.find((x) => x.done < x.exercises);
  if (!t) return null;
  return t.typeId;
}

/**
 * הודעת וואטסאפ מוכנה לאבא – מנוסחת לפי מצב היום.
 * אבא תמיד יכול לערוך לפני שליחה; זו רק נקודת פתיחה בקול נכון.
 */
export function nudgeText(p: Plan, typeTitle: (id: string) => string): string {
  const m = missionOf(p);
  const days = p.daysLeft === 1 ? "המבחן מחר" : `עוד ${p.daysLeft} ימים למבחן`;
  if (m.state === "done") {
    return `נוגה! ראיתי שסגרת את היום באפליקציה – ${m.doneEx} תרגילים 💪 גאה בך. ${days}, ואת בדרך הנכונה.`;
  }
  if (m.doneEx > 0) {
    return `היי נוגצ'קה 🙂 ראיתי שהתחלת היום (${m.doneEx}/${m.targetEx}) – נשארו רק ${m.remainEx} תרגילים, בערך ${m.remainMinutes} דקות. סוגרים את זה הערב?`;
  }
  const first = m.firstOpenTypeId ? ` מתחילים ב"${typeTitle(m.firstOpenTypeId)}"?` : "";
  return `היי נוגה 🙂 ${days}. היום בתוכנית: ${m.targetEx} תרגילים, בערך ${m.remainMinutes} דקות.${first} קטן עלייך 💜`;
}
