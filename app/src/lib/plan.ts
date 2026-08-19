/**
 * 🎯 תוכנית עבודה עד המבחן ("הדרך ל-1.9").
 *
 * הרעיון: לא תוכנית קשיחה שנכתבה פעם אחת, אלא תוכנית שמחושבת מחדש בכל פתיחה
 * מתוך (א) ההגדרות של אבא (תאריך מבחן, דקות ביום, ימי חופש), (ב) מה שנגה כבר
 * יודעת לפי ההתקדמות באפליקציה (mastery/כוכבים לכל סוג תרגיל), ו-(ג) מה שנעשה היום.
 * ככה יום שפספסה לא "נשרף" – העבודה נפרסת מחדש על הימים שנשארו, והמסך תמיד
 * אומר את האמת: "זה מה שנשאר, זה מה שאפשר היום".
 *
 * טהור (ללא DB) – כדי שאפשר יהיה לבדוק ביחידה.
 */
import type { AttemptRow } from "./db";
import { TOPICS, ALL_TYPES, RECOMMENDED_PATH } from "@/content/topics";
import type { Summary } from "./progress";

export const PLAN_SETTING_KEY = "exam_plan";
export const TZ = "Asia/Jerusalem";

export interface PlanSettings {
  enabled: boolean;
  /** YYYY-MM-DD – יום המבחן עצמו (לא מתרגלים בו) */
  examDate: string;
  examTitle: string;
  /** דקות ביום רגיל (א'–ה') */
  minutesPerDay: number;
  /** דקות ביום שישי/שבת */
  weekendMinutes: number;
  /** ימים שבהם לא מתרגלים (YYYY-MM-DD) */
  offDays: string[];
  /** משפט קצר מאבא שמופיע למעלה (אופציונלי) */
  note: string;
}

export const DEFAULT_PLAN: PlanSettings = {
  enabled: true,
  examDate: "2026-09-01",
  examTitle: "מבחן המעבר ל-4 יח״ל",
  minutesPerDay: 40,
  weekendMinutes: 60,
  offDays: [],
  note: "",
};

export function normalizeSettings(raw: unknown): PlanSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<PlanSettings>;
  const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_PLAN.enabled,
    examDate: typeof o.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.examDate) ? o.examDate : DEFAULT_PLAN.examDate,
    examTitle: typeof o.examTitle === "string" && o.examTitle.trim() ? o.examTitle.trim().slice(0, 60) : DEFAULT_PLAN.examTitle,
    minutesPerDay: num(o.minutesPerDay, DEFAULT_PLAN.minutesPerDay, 0, 240),
    weekendMinutes: num(o.weekendMinutes, DEFAULT_PLAN.weekendMinutes, 0, 300),
    offDays: Array.isArray(o.offDays) ? [...new Set(o.offDays.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [],
    note: typeof o.note === "string" ? o.note.trim().slice(0, 200) : "",
  };
}

/* ---------------- תאריכים (שעון ישראל) ---------------- */

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD לפי שעון ישראל */
export function ilDay(d: Date | string): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}
/** יום בשבוע 0=א' … 6=ש' */
export function dow(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / 86400000);
}
export const DOW_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  const [, m, d] = day.split("-").map(Number);
  return `יום ${DOW_HE[dow(day)]} ${d}.${m}`;
}

/* ---------------- מודל ---------------- */

export type TaskKind = "learn" | "review" | "mock";
export interface PlanTask {
  typeId: string;
  topicId: string;
  kind: TaskKind;
  minutes: number;
  exercises: number;
  /** כמה תרגילים נעשו היום בסוג הזה (רק ליום הנוכחי) */
  done: number;
}
export interface PlanDay {
  date: string;
  label: string;
  off: boolean;
  minutes: number; // יעד
  tasks: PlanTask[];
  /** בפועל (לימים שעברו והיום) */
  actualMinutes: number;
  actualCount: number;
}
export type Readiness = "ready" | "almost" | "started" | "new";
export interface TypeNeed {
  typeId: string;
  topicId: string;
  title: string;
  mastery: number;
  stars: number;
  attempts: number;
  readiness: Readiness;
  /** תרגילים שנותרו כדי להגיע ל"מוכן" */
  needEx: number;
  needMin: number;
}
export interface Plan {
  settings: PlanSettings;
  today: string;
  examDate: string;
  daysLeft: number; // ימים עד המבחן (לא כולל היום? כולל – ראו חישוב)
  studyDaysLeft: number; // ימי תרגול שנותרו (בלי חופש, בלי יום המבחן), כולל היום
  availableMinutes: number;
  requiredMinutes: number;
  /** 0..1 – כמה מהעבודה הנדרשת נכנסת בזמן שיש */
  coverage: number;
  avgMinPerEx: number;
  needs: TypeNeed[];
  readyTypes: number;
  totalTypes: number;
  days: PlanDay[]; // מהיום עד יום לפני המבחן
  history: PlanDay[]; // 7 ימים אחרונים לפני היום (רק בפועל)
  todayTasks: PlanTask[];
  todayMinutes: number; // יעד היום
  todayDoneMinutes: number;
  todayDoneCount: number;
  /** הודעה קצרה לנגה – מצב */
  status: "done" | "on_track" | "behind" | "exam_passed" | "disabled";
}

const TYPE_TITLE: Record<string, string> = Object.fromEntries(ALL_TYPES.map((t) => [t.id, t.title]));
const TOPIC_ORDER: Record<string, number> = Object.fromEntries(RECOMMENDED_PATH.map((id, i) => [id, i]));

/** דקות ממוצעות לתרגיל (נסיון חי או ברירת מחדל 3) */
function avgMinutes(rows: AttemptRow[]): number {
  const solved = rows.filter((r) => !r.skipped && r.duration_sec > 10 && r.duration_sec < 1200);
  if (solved.length < 5) return 3;
  const s = solved.reduce((a, r) => a + r.duration_sec, 0) / solved.length / 60;
  return Math.min(6, Math.max(1.5, Math.round(s * 2) / 2));
}

export function readinessOf(t: { mastery: number; stars: number; attempts: number }): Readiness {
  if (t.attempts === 0) return "new";
  if (t.stars >= 2 || (t.mastery >= 0.75 && t.attempts >= 6)) return "ready";
  if (t.mastery >= 0.45 && t.attempts >= 3) return "almost";
  return "started";
}
export const READINESS_LABEL: Record<Readiness, string> = { ready: "מוכן", almost: "כמעט", started: "בתהליך", new: "עוד לא התחלנו" };

function needsOf(summary: Summary, avgMin: number): TypeNeed[] {
  return ALL_TYPES.map((t) => {
    const tp = summary.types[t.id] ?? { mastery: 0, stars: 0, attempts: 0 };
    const readiness = readinessOf(tp);
    // כמה תרגילים עד "מוכן": חדש ≈ 8, בתהליך לפי הפער, מוכן → 2 לתחזוקה
    let needEx: number;
    if (readiness === "ready") needEx = 2;
    else if (readiness === "new") needEx = 8;
    else needEx = Math.max(3, Math.min(8, Math.ceil((0.8 - tp.mastery) * 10) + 2));
    return { typeId: t.id, topicId: t.topicId, title: t.title, mastery: tp.mastery, stars: tp.stars, attempts: tp.attempts, readiness, needEx, needMin: Math.round(needEx * avgMin) };
  }).sort((a, b) => (TOPIC_ORDER[a.topicId] ?? 99) - (TOPIC_ORDER[b.topicId] ?? 99));
}

/**
 * בניית התוכנית. rows = כל הניסיונות של נגה; summary = summarize(rows).
 */
export function buildPlan(rows: AttemptRow[], summary: Summary, settings: PlanSettings, now = new Date()): Plan {
  const today = ilDay(now);
  const examDate = settings.examDate;
  const avgMin = avgMinutes(rows);
  const needs = needsOf(summary, avgMin);
  const totalTypes = needs.length;
  const readyTypes = needs.filter((n) => n.readiness === "ready").length;

  // בפועל – לפי יום (שעון ישראל)
  const actual = new Map<string, { minutes: number; count: number; byType: Map<string, number> }>();
  for (const r of rows) {
    const k = ilDay(r.created_at);
    const a = actual.get(k) ?? { minutes: 0, count: 0, byType: new Map() };
    a.minutes += r.duration_sec / 60;
    if (!r.skipped) {
      a.count++;
      a.byType.set(r.type_id, (a.byType.get(r.type_id) ?? 0) + 1);
    }
    actual.set(k, a);
  }
  const actualOf = (d: string) => actual.get(d) ?? { minutes: 0, count: 0, byType: new Map<string, number>() };

  const history: PlanDay[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = addDays(today, -i);
    const a = actualOf(d);
    const off = settings.offDays.includes(d);
    history.push({ date: d, label: dayLabel(d, today), off, minutes: off ? 0 : dow(d) >= 5 ? settings.weekendMinutes : settings.minutesPerDay, tasks: [], actualMinutes: Math.round(a.minutes), actualCount: a.count });
  }

  const daysLeft = daysBetween(today, examDate);
  const base = (p: Partial<Plan>): Plan => ({
    settings,
    today,
    examDate,
    daysLeft,
    studyDaysLeft: 0,
    availableMinutes: 0,
    requiredMinutes: needs.filter((n) => n.readiness !== "ready").reduce((s, n) => s + n.needMin, 0),
    coverage: 1,
    avgMinPerEx: avgMin,
    needs,
    readyTypes,
    totalTypes,
    days: [],
    history,
    todayTasks: [],
    todayMinutes: 0,
    todayDoneMinutes: Math.round(actualOf(today).minutes),
    todayDoneCount: actualOf(today).count,
    status: "on_track",
    ...p,
  });
  if (!settings.enabled) return base({ status: "disabled" });
  if (daysLeft <= 0) return base({ status: "exam_passed" });

  // ימי תרגול: מהיום עד יום לפני המבחן
  const days: PlanDay[] = [];
  for (let d = today; daysBetween(d, examDate) > 0; d = addDays(d, 1)) {
    const off = settings.offDays.includes(d);
    const a = actualOf(d);
    days.push({ date: d, label: dayLabel(d, today), off, minutes: off ? 0 : dow(d) >= 5 ? settings.weekendMinutes : settings.minutesPerDay, tasks: [], actualMinutes: Math.round(a.minutes), actualCount: a.count });
  }
  const studyDays = days.filter((d) => !d.off && d.minutes > 0);
  const availableMinutes = studyDays.reduce((s, d) => s + d.minutes, 0);

  // העבודה: סוגים שעוד לא מוכנים (כולל תחזוקה קלה למוכנים), בסדר המסלול
  // היום הראשון כבר עשוי להכיל עבודה שנעשתה – מפחיתים מהצורך
  const todayBy = actualOf(today).byType;
  // סוגים "מוכנים" לא נכנסים לתור הלמידה – הם חוזרים רק בחלון החזרה המרווחת (ובחזרה המעורבת)
  const work = needs.filter((n) => n.readiness !== "ready").map((n) => ({ ...n, remainEx: Math.max(0, n.needEx - (todayBy.get(n.typeId) ?? 0)) }));
  const requiredMinutes = Math.round(work.reduce((s, w) => s + w.remainEx * avgMin, 0));

  // יום אחרון לפני המבחן (אם יש ≥3 ימי תרגול): חזרה מעורבת – תרגיל אחד מכל סוג שנגעה בו
  const mockDay = studyDays.length >= 3 ? studyDays[studyDays.length - 1] : null;
  const fillDays = mockDay ? studyDays.slice(0, -1) : studyDays;
  const fillMinutes = fillDays.reduce((s, d) => s + d.minutes, 0);

  // אם לא נכנס – מכווצים פרופורציונלית (אבל שומרים מינימום 2 לכל סוג שלא מוכן)
  // ~15% מהזמן שמור לחזרה מרווחת על מה שכבר נלמד
  const learnMinutes = Math.round(fillMinutes * 0.85);
  let scale = 1;
  if (requiredMinutes > learnMinutes && learnMinutes > 0) scale = learnMinutes / requiredMinutes;
  const coverage = requiredMinutes ? Math.min(1, learnMinutes / requiredMinutes) : 1;

  // מילוי חמדני, יום-יום: למידה לפי סדר המסלול (הבא בתור), ובסוף היום חזרה קצרה
  // על סוג שכבר נלמד (חזרה מרווחת). אם הזמן קצר – הלמידה מקבלת את כל היום.
  const queue = work
    .filter((w) => w.remainEx > 0)
    .map((w) => ({ ...w, remainEx: Math.max(2, scale < 1 ? Math.floor(w.remainEx * scale) : w.remainEx) }));
  const learned = new Set<string>(needs.filter((n) => n.attempts > 0).map((n) => n.typeId)); // מה שכבר אפשר לחזור עליו
  const needOf = (id: string) => needs.find((n) => n.typeId === id)!;
  const lastTouch = new Map<string, number>(); // אינדקס יום אחרון שבו נגענו בסוג – לחזרה מרווחת מסתובבת
  let dayIdx = 0;

  for (const day of fillDays) {
    dayIdx++;
    let budget = day.minutes;
    const dayTasks: PlanTask[] = [];
    const done = day.date === today ? todayBy : new Map<string, number>();
    // 0) היום: מה שכבר נעשה נשאר על המסך כ-✔ (ולא "נעלם" מהתוכנית)
    if (day.date === today) {
      for (const [typeId, count] of done) {
        const n = needs.find((x) => x.typeId === typeId);
        if (!n || !count) continue;
        const mins = Math.round(count * avgMin);
        dayTasks.push({ typeId, topicId: n.topicId, kind: n.readiness === "ready" ? "review" : "learn", minutes: mins, exercises: count, done: count });
        budget -= mins;
      }
    }
    const dayBudget = Math.max(0, budget);
    const reviewSlot = Math.round(dayBudget * 0.25);
    // 1) למידה – מהתור, לפי הסדר; משאירים ~25% לחזרה רק אם באמת יש על מה לחזור
    const learn = (reserve: boolean) => {
      for (const q of queue) {
        if (q.remainEx <= 0) continue;
        if (dayTasks.filter((t) => t.done < t.exercises).length >= 3) break; // לא יותר מ-3 משימות פתוחות ביום
        const hasReview = reserve && [...learned].some((id) => !dayTasks.some((t) => t.typeId === id) && id !== q.typeId);
        const room = hasReview ? budget - reviewSlot : budget;
        if (room < avgMin * 3 && dayTasks.length) break; // בלי פירורים של תרגיל-שניים
        let ex = Math.max(1, Math.min(q.remainEx, Math.floor(Math.max(room, avgMin) / avgMin)));
        // בלי להשאיר "שארית" של תרגיל-שניים למחר: או לוקחים הכול (עד 2 תרגילים מעבר), או משאירים ≥3
        const remnant = q.remainEx - ex;
        if (remnant > 0 && remnant <= 2) ex = q.remainEx * avgMin <= room + avgMin * 2 ? q.remainEx : Math.max(1, q.remainEx - 3);
        q.remainEx -= ex;
        learned.add(q.typeId);
        lastTouch.set(q.typeId, dayIdx);
        const mins = Math.round(ex * avgMin);
        const existing = dayTasks.find((t) => t.typeId === q.typeId);
        if (existing) {
          existing.exercises += ex;
          existing.minutes += mins;
        } else dayTasks.push({ typeId: q.typeId, topicId: q.topicId, kind: q.readiness === "ready" ? "review" : "learn", minutes: mins, exercises: ex, done: done.get(q.typeId) ?? 0 });
        budget -= mins;
      }
    };
    learn(true);
    // 2) חזרה מרווחת – סוג שכבר נלמד (קודם כל מה שעוד לא מוכן, ואז הכי חלש), שלא נבחר היום
    if (budget >= avgMin * 2) {
      const cands = [...learned]
        .filter((id) => !dayTasks.some((t) => t.typeId === id))
        .map((id) => ({ id, q: queue.find((x) => x.typeId === id), n: needOf(id) }))
        .sort((a, b) => (b.q?.remainEx ? 1 : 0) - (a.q?.remainEx ? 1 : 0) || (lastTouch.get(a.id) ?? 0) - (lastTouch.get(b.id) ?? 0) || a.n.mastery - b.n.mastery || (TOPIC_ORDER[a.n.topicId] ?? 99) - (TOPIC_ORDER[b.n.topicId] ?? 99));
      const c = cands[0];
      if (c) {
        lastTouch.set(c.id, dayIdx);
        const want = c.q?.remainEx ? c.q.remainEx : 2;
        const ex = Math.max(1, Math.min(want, Math.floor(budget / avgMin)));
        if (c.q) c.q.remainEx = Math.max(0, c.q.remainEx - ex);
        const mins = Math.round(ex * avgMin);
        dayTasks.push({ typeId: c.id, topicId: c.n.topicId, kind: "review", minutes: mins, exercises: ex, done: done.get(c.id) ?? 0 });
        budget -= mins;
      }
    }
    // 2ב) נשאר זמן? ממשיכים ללמוד (בלי לשמור לחזרה)
    if (budget >= avgMin * 3) learn(false);
    // 3) יום בלי כלום (הכול מוכן ואין מה לחזור עליו) – חזרה חופשית על הסוג החלש ביותר
    if (!dayTasks.length && budget >= avgMin) {
      const weakest = [...needs].sort((a, b) => a.mastery - b.mastery)[0];
      if (weakest) {
        const ex = Math.max(1, Math.floor(Math.min(budget, 30) / avgMin));
        dayTasks.push({ typeId: weakest.typeId, topicId: weakest.topicId, kind: "review", minutes: Math.round(ex * avgMin), exercises: ex, done: done.get(weakest.typeId) ?? 0 });
      }
    }
    day.tasks = dayTasks;
  }
  if (mockDay) {
    const done = mockDay.date === today ? todayBy : new Map<string, number>();
    const touched = needs.filter((n) => n.attempts > 0 || learned.has(n.typeId)).sort((a, b) => a.mastery - b.mastery || (TOPIC_ORDER[a.topicId] ?? 99) - (TOPIC_ORDER[b.topicId] ?? 99));
    const perEx = Math.max(1, Math.floor(mockDay.minutes / avgMin));
    const pick = touched.slice(0, perEx);
    mockDay.tasks = pick.map((n) => ({ typeId: n.typeId, topicId: n.topicId, kind: "mock" as const, minutes: Math.round(avgMin), exercises: 1, done: done.get(n.typeId) ?? 0 }));
  }

  const todayDay = days[0]?.date === today ? days[0] : null;
  const todayTasks = todayDay?.tasks ?? [];
  const todayMinutes = todayDay?.minutes ?? 0;
  const todayDone = actualOf(today);
  const todayTarget = todayTasks.reduce((s, t) => s + t.exercises, 0);
  const todayAchieved = todayTasks.reduce((s, t) => s + Math.min(t.done, t.exercises), 0);
  let status: Plan["status"] = "on_track";
  if (todayDay && !todayDay.off && todayTarget > 0 && todayAchieved >= todayTarget) status = "done";
  else if (coverage < 0.7) status = "behind";

  return base({
    studyDaysLeft: studyDays.length,
    availableMinutes,
    requiredMinutes,
    coverage,
    days,
    todayTasks,
    todayMinutes,
    todayDoneMinutes: Math.round(todayDone.minutes),
    todayDoneCount: todayDone.count,
    status,
  });
}

export function typeTitle(id: string): string {
  return TYPE_TITLE[id] ?? id;
}
export function topicOf(id: string) {
  return TOPICS.find((t) => t.id === id);
}
export const KIND_LABEL: Record<TaskKind, string> = { learn: "ללמוד/לחזק", review: "חזרה", mock: "חזרה מעורבת" };
