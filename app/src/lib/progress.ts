import type { AttemptRow } from "./db";
import { TOPICS, ALL_TYPES, BADGES } from "@/content/topics";

export interface TypeProgress {
  typeId: string;
  topicId: string;
  attempts: number;
  correct: number;
  hints: number;
  reveals: number;
  lastLevel: number;
  stars: 0 | 1 | 2 | 3;
  mastery: number; // 0..1
}
export interface TopicProgress {
  topicId: string;
  attempts: number;
  correct: number;
  stars: 0 | 1 | 2 | 3;
  mastery: number;
}
export interface Summary {
  xp: number;
  level: number;
  streak: number;
  todayMinutes: number;
  totalMinutes: number;
  todayCount: number;
  totalCorrect: number;
  totalAttempts: number;
  types: Record<string, TypeProgress>;
  topics: Record<string, TopicProgress>;
  badges: string[];
  days: { date: string; minutes: number; count: number; correct: number }[]; // last 28 days
  mistakes: { key: string; count: number }[];
  recent: AttemptRow[];
  /** אנליטיקה לנגה – מה שסוכם: זמן, היסוס, רמזים, סוג טעות, רצף, שעה, נטישה */
  analytics: {
    avgDurationSec: number;
    avgFirstInputSec: number | null;
    skipped: number;
    byHour: { hour: number; count: number; accuracy: number }[]; // only hours with ≥3 attempts
    byPosition: { label: string; count: number; accuracy: number; hintRate: number }[]; // position within a session (gap 25 min)
    todayWrong: number; // wrong lines today
    sessions: number;
  };
}

const dayKey = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function xpFor(a: { correct: boolean; hints: number; reveals: number; level: number }) {
  if (!a.correct) return 2;
  let xp = 10 * a.level;
  xp -= a.hints * 2 + a.reveals * 4;
  return Math.max(3, xp);
}

export function summarize(rows: AttemptRow[], now = new Date()): Summary {
  const types: Record<string, TypeProgress> = {};
  for (const t of ALL_TYPES) types[t.id] = { typeId: t.id, topicId: t.topicId, attempts: 0, correct: 0, hints: 0, reveals: 0, lastLevel: 1, stars: 0, mastery: 0 };
  let xp = 0;
  const byDay = new Map<string, { minutes: number; count: number; correct: number }>();
  const mistakeCount = new Map<string, number>();
  for (const r of rows) {
    const tp = types[r.type_id];
    if (tp) {
      tp.attempts++;
      if (r.correct) tp.correct++;
      tp.hints += r.hints;
      tp.reveals += r.reveals;
      tp.lastLevel = r.level;
    }
    xp += xpFor(r);
    const k = dayKey(new Date(r.created_at));
    const d = byDay.get(k) ?? { minutes: 0, count: 0, correct: 0 };
    d.minutes += r.duration_sec / 60;
    d.count++;
    if (r.correct) d.correct++;
    byDay.set(k, d);
    for (const m of r.mistakes ?? []) mistakeCount.set(m, (mistakeCount.get(m) ?? 0) + 1);
  }
  // mastery: recent-weighted correctness without reveals, at level
  for (const tp of Object.values(types)) {
    const recent = rows.filter((r) => r.type_id === tp.typeId).slice(-8);
    if (!recent.length) continue;
    const score = recent.reduce((s, r) => s + (r.correct ? (r.reveals ? 0.4 : r.hints ? 0.7 : 1) : 0) * (0.6 + 0.2 * r.level), 0) / (recent.length * 1.2);
    tp.mastery = Math.min(1, score);
    const cleanCorrect = recent.filter((r) => r.correct && !r.reveals).length;
    tp.stars = tp.mastery > 0.85 && cleanCorrect >= 6 && recent.some((r) => r.level >= 3) ? 3 : tp.mastery > 0.6 && cleanCorrect >= 4 ? 2 : cleanCorrect >= 2 ? 1 : 0;
  }
  const topics: Record<string, TopicProgress> = {};
  for (const t of TOPICS) {
    const ts = t.types.map((ty) => types[ty.id]);
    const attempts = ts.reduce((s, x) => s + x.attempts, 0);
    const correct = ts.reduce((s, x) => s + x.correct, 0);
    const mastery = ts.length ? ts.reduce((s, x) => s + x.mastery, 0) / ts.length : 0;
    const stars = Math.min(...ts.map((x) => x.stars)) as 0 | 1 | 2 | 3;
    topics[t.id] = { topicId: t.id, attempts, correct, mastery, stars: attempts ? stars : 0 };
  }
  // streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    if (byDay.has(k)) streak++;
    else if (i === 0) continue; // today not yet – don't break
    else break;
  }
  const days: Summary["days"] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const v = byDay.get(k) ?? { minutes: 0, count: 0, correct: 0 };
    days.push({ date: k, ...v });
  }
  const today = byDay.get(dayKey(now)) ?? { minutes: 0, count: 0, correct: 0 };
  const totalMinutes = [...byDay.values()].reduce((s, d) => s + d.minutes, 0);
  const totalCorrect = rows.filter((r) => r.correct).length;
  // badges
  const badges: string[] = [];
  const countTopic = (topicId: string) => rows.filter((r) => r.topic_id === topicId && r.correct).length;
  if (totalCorrect >= 1) badges.push("first");
  if (countTopic("families") >= 10) badges.push("cats10");
  if (countTopic("parens") >= 10) badges.push("kiss10");
  if (countTopic("common_factor") >= 10) badges.push("vaad10");
  if (countTopic("linear_eq") + countTopic("linear_eq_frac") >= 10) badges.push("liberman10");
  if (countTopic("systems") >= 10) badges.push("stalin10");
  if (countTopic("domain") >= 10) badges.push("guard10");
  if (countTopic("quadratic_eq") >= 10) badges.push("zero10");
  if (countTopic("linear_func") >= 10) badges.push("floors10");
  if (countTopic("parabola") + countTopic("parabola_line") >= 10) badges.push("smile10");
  if (countTopic("analytic") >= 10) badges.push("pyth10");
  {
    let run = 0,
      best = 0;
    for (const r of rows) {
      if (r.correct && !r.hints && !r.reveals) run++;
      else run = 0;
      best = Math.max(best, run);
    }
    if (best >= 5) badges.push("nohint");
  }
  if (streak >= 3) badges.push("streak3");
  if (streak >= 7) badges.push("streak7");
  if (Object.values(topics).some((t) => t.stars === 3)) badges.push("master");
  const level = Math.floor(Math.sqrt(xp / 25)) + 1;

  // ---- analytics ----
  const solved = rows.filter((r) => !r.skipped);
  const avgDurationSec = solved.length ? Math.round(solved.reduce((s, r) => s + r.duration_sec, 0) / solved.length) : 0;
  const fi = solved.filter((r) => typeof r.first_input_sec === "number");
  const avgFirstInputSec = fi.length ? Math.round(fi.reduce((s, r) => s + (r.first_input_sec ?? 0), 0) / fi.length) : null;
  const skipped = rows.filter((r) => r.skipped).length;
  const hourMap = new Map<number, { count: number; correct: number }>();
  for (const r of rows) {
    const h = new Date(r.created_at).getHours();
    const v = hourMap.get(h) ?? { count: 0, correct: 0 };
    v.count++;
    if (r.correct && !r.reveals) v.correct++;
    hourMap.set(h, v);
  }
  const byHour = [...hourMap.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([hour, v]) => ({ hour, count: v.count, accuracy: v.correct / v.count }))
    .sort((a, b) => a.hour - b.hour);
  // sessions: split by 25-minute gaps; position buckets 1-3, 4-6, 7-10, 11+
  const buckets = [
    { label: "1–3", lo: 1, hi: 3 },
    { label: "4–6", lo: 4, hi: 6 },
    { label: "7–10", lo: 7, hi: 10 },
    { label: "11+", lo: 11, hi: 999 },
  ].map((b) => ({ ...b, count: 0, correct: 0, hints: 0 }));
  let sessions = 0;
  let pos = 0;
  let last = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (!last || t - last > 25 * 60 * 1000) {
      sessions++;
      pos = 0;
    }
    last = t;
    pos++;
    const b = buckets.find((x) => pos >= x.lo && pos <= x.hi)!;
    b.count++;
    if (r.correct && !r.reveals && r.wrong_lines === 0) b.correct++;
    if (r.hints || r.reveals) b.hints++;
  }
  const byPosition = buckets.filter((b) => b.count > 0).map((b) => ({ label: b.label, count: b.count, accuracy: b.correct / b.count, hintRate: b.hints / b.count }));
  const todayWrong = rows.filter((r) => dayKey(new Date(r.created_at)) === dayKey(now)).reduce((s, r) => s + r.wrong_lines, 0);

  return {
    analytics: { avgDurationSec, avgFirstInputSec, skipped, byHour, byPosition, todayWrong, sessions },
    xp,
    level,
    streak,
    todayMinutes: Math.round(today.minutes),
    totalMinutes: Math.round(totalMinutes),
    todayCount: today.count,
    totalCorrect,
    totalAttempts: rows.length,
    types,
    topics,
    badges: badges.filter((b) => BADGES.some((x) => x.id === b)),
    days,
    mistakes: [...mistakeCount.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    recent: rows.slice(-25).reverse(),
  };
}

export const MISTAKE_LABELS: Record<string, string> = {
  sign: "סימנים (מינוס לפני סוגריים / כנופיות)",
  kiss: "נשיקה לא לכולם (פתיחת סוגריים)",
  families: "איחוד משפחות (חיבור איברים לא דומים)",
  cancel: "צמצום כשיש חיבור/חיסור",
  mirror: "מראת הקסמים (העברת אגפים)",
  fraction: "שברים / טרומפלדור",
  gulag: "גולאג (חיבור/חיסור משוואות)",
  final: "תשובה סופית שגויה",
  parse: "כתיב לא ברור",
  divx: "חילוק ב-x (איבוד הפתרון x=0)",
  pow_sum: "(a+b)² = a²+b² (חזקה על חיבור)",
  coef_sq: "(kx)² – המקדם לא הועלה בריבוע",
  domain_first: "צמצום לפני תחום הצבה",
  domain_missing: "תחום הצבה חסר ערך",
  domain_wrong: "תחום הצבה – ערך שגוי",
  pm: "חזקה זוגית – שכחה את ±",
  order: "סדר פעולות – נכון אבל לא משמאל לימין (הרגל)",
  pair_order: "סדר בתוך זוג (משמאל לימין)",
  abc: "a, b, c – סימנים",
  formula: "נוסחת השורשים – הצבה",
  slope_flip: "שיפוע הפוך (צעדים חלקי קומות)",
  perp: "מאונך – הפכת רק פעם אחת (הפוך והפוך)",
  axis_mix: "בלבול בין הקיר (ציר y) לרצפה (ציר x)",
  vertex_sign: "קודקוד – הסימן של −b/2a",
  sqrt: "מרחק – שכחה את השורש (פיתגורס)",
  mid_sub: "אמצע – חיסור/בלי חלוקה ב-2 במקום ממוצע",
  area_half: "שטח – שכחה לחלק ב-2",
  point: "נקודה שגויה / לא הנקודה שביקשו",
  geo: "פונקציות ואנליטית – אחר",
  other: "אחר",
};
