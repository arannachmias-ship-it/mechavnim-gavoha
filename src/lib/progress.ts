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
  return {
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
  other: "אחר",
};
