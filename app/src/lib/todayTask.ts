import type { Plan, PlanTask } from "./plan";

/**
 * 🧭 "איפה אני בתוך המשימה של היום" – מהתוכנית, בתוך מסך התרגול.
 *
 * בלי זה נגה לא יודעת שסיימה את המכסה של הנושא, ויכולה להיתקע בו עד אינסוף
 * בזמן שנושא אחר בתוכנית לא נגעה בו בכלל. הפונקציה טהורה כדי שאפשר יהיה לבדוק ביחידה.
 */
export interface TaskFocus {
  /** יש תוכנית פעילה עם משימות להיום */
  active: boolean;
  /** הנושא הנוכחי הוא אחת ממשימות היום */
  inPlan: boolean;
  /** יעד התרגילים היום בנושא הזה */
  target: number;
  /** כמה כבר נעשו היום בנושא הזה (עד היעד) */
  done: number;
  /** המכסה של הנושא הזה הושלמה – מכאן זה בונוס */
  complete: boolean;
  /** המשימה הפתוחה הבאה (נושא אחר) – לשם דוחפים */
  next: PlanTask | null;
  /** כל משימות היום הושלמו */
  dayDone: boolean;
}

export function taskFocus(plan: Plan | null, typeId: string): TaskFocus {
  const off = !plan || plan.status === "disabled" || plan.status === "exam_passed" || !!plan.days[0]?.off;
  const tasks = off || !plan ? [] : plan.todayTasks;
  const mine = tasks.find((t) => t.typeId === typeId) ?? null;
  const open = tasks.filter((t) => t.done < t.exercises);
  return {
    active: tasks.length > 0,
    inPlan: !!mine,
    target: mine?.exercises ?? 0,
    done: mine ? Math.min(mine.done, mine.exercises) : 0,
    complete: !!mine && mine.done >= mine.exercises,
    next: open.find((t) => t.typeId !== typeId) ?? null,
    dayDone: tasks.length > 0 && open.length === 0,
  };
}
