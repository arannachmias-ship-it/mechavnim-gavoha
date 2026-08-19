import { describe, it, expect } from "vitest";
import { buildPlan, DEFAULT_PLAN, normalizeSettings, ilDay, addDays, daysBetween, dow } from "./plan";
import { summarize } from "./progress";
import type { AttemptRow } from "./db";
import { ALL_TYPES } from "@/content/topics";

let id = 1;
function row(p: Partial<AttemptRow> & { type_id: string; created_at: string }): AttemptRow {
  const topic = ALL_TYPES.find((t) => t.id === p.type_id)!.topicId;
  return {
    id: id++,
    profile: "noga",
    topic_id: topic,
    level: 1,
    correct: true,
    hints: 0,
    reveals: 0,
    wrong_lines: 0,
    duration_sec: 150,
    lines: [],
    prompt: "",
    mistakes: [],
    first_input_sec: 5,
    skipped: false,
    calc_uses: 0,
    ...p,
  };
}

const NOW = new Date("2026-08-19T10:00:00+03:00"); // יום ד'
const today = ilDay(NOW);

describe("plan dates", () => {
  it("israel day + arithmetic", () => {
    expect(today).toBe("2026-08-19");
    expect(ilDay("2026-08-19T22:30:00Z")).toBe("2026-08-20"); // 01:30 בישראל
    expect(addDays("2026-08-30", 2)).toBe("2026-09-01");
    expect(daysBetween("2026-08-19", "2026-09-01")).toBe(13);
    expect(dow("2026-08-21")).toBe(5); // שישי
  });
  it("normalizes settings", () => {
    const s = normalizeSettings({ minutesPerDay: 1000, examDate: "bad", offDays: ["2026-08-25", "x", "2026-08-25"] });
    expect(s.minutesPerDay).toBe(240);
    expect(s.examDate).toBe(DEFAULT_PLAN.examDate);
    expect(s.offDays).toEqual(["2026-08-25"]);
  });
});

describe("buildPlan", () => {
  it("empty history: plan covers all days until exam, every study day has tasks", () => {
    const rows: AttemptRow[] = [];
    const p = buildPlan(rows, summarize(rows, NOW), DEFAULT_PLAN, NOW);
    expect(p.daysLeft).toBe(13);
    expect(p.days.length).toBe(13);
    expect(p.days[0].date).toBe(today);
    expect(p.days[p.days.length - 1].date).toBe("2026-08-31");
    expect(p.studyDaysLeft).toBe(13);
    for (const d of p.days) expect(d.tasks.length).toBeGreaterThan(0);
    expect(p.todayTasks.length).toBeGreaterThan(0);
    expect(p.readyTypes).toBe(0);
    // 21 סוגים × 8 תרגילים × 3 דק' = 504 דק' נדרשות; זמין 9×40+4×60 = 600
    expect(p.requiredMinutes).toBe(504);
    expect(p.availableMinutes).toBe(600);
    expect(p.coverage).toBeGreaterThan(0.9);
    // יום אחרון = חזרה מעורבת
    expect(p.days[p.days.length - 1].tasks.every((t) => t.kind === "mock")).toBe(true);
    // כל סוג מופיע לפחות פעם אחת לפני יום החזרה
    const seen = new Set(p.days.slice(0, -1).flatMap((d) => d.tasks.map((t) => t.typeId)));
    expect(seen.size).toBe(ALL_TYPES.length);
    // היום לא חורג מהיעד בצורה משמעותית
    const tm = p.todayTasks.reduce((s, t) => s + t.minutes, 0);
    expect(tm).toBeLessThanOrEqual(p.todayMinutes + 3);
    expect(p.status).toBe("on_track");
  });

  it("off days have no tasks; too little time → behind + coverage<1", () => {
    const rows: AttemptRow[] = [];
    const s = { ...DEFAULT_PLAN, minutesPerDay: 10, weekendMinutes: 10, offDays: ["2026-08-20", "2026-08-21"] };
    const p = buildPlan(rows, summarize(rows, NOW), s, NOW);
    expect(p.days.find((d) => d.date === "2026-08-20")!.off).toBe(true);
    expect(p.days.find((d) => d.date === "2026-08-20")!.tasks.length).toBe(0);
    expect(p.studyDaysLeft).toBe(11);
    expect(p.coverage).toBeLessThan(0.7);
    expect(p.status).toBe("behind");
  });

  it("work done today shows as done and completes the day", () => {
    const rows: AttemptRow[] = [];
    // 12 תרגילים נקיים היום בסדר פעולות ו-8 באיחוד משפחות – הרבה מעבר ליעד היומי
    for (let i = 0; i < 12; i++) rows.push(row({ type_id: "order_ops", created_at: `2026-08-19T08:${10 + i}:00+03:00`, level: 2 }));
    for (let i = 0; i < 8; i++) rows.push(row({ type_id: "like_terms", created_at: `2026-08-19T09:${10 + i}:00+03:00`, level: 2 }));
    const p = buildPlan(rows, summarize(rows, NOW), DEFAULT_PLAN, NOW);
    const t0 = p.todayTasks.find((t) => t.typeId === "order_ops")!;
    expect(t0.done).toBe(12);
    expect(t0.done).toBeGreaterThanOrEqual(t0.exercises);
    expect(p.status).toBe("done");
    expect(p.todayDoneCount).toBe(20);
    // סדר פעולות מוכן → לא מתוכנן שוב כלמידה מחר
    expect(p.needs.find((n) => n.typeId === "order_ops")!.readiness).toBe("ready");
    expect(p.days[1].tasks.some((t) => t.typeId === "order_ops" && t.kind === "learn")).toBe(false);
  });

  it("history shows actual minutes for past 7 days", () => {
    const rows = [row({ type_id: "order_ops", created_at: "2026-08-17T18:00:00+03:00", duration_sec: 600 })];
    const p = buildPlan(rows, summarize(rows, NOW), DEFAULT_PLAN, NOW);
    expect(p.history.length).toBe(7);
    expect(p.history.find((h) => h.date === "2026-08-17")!.actualMinutes).toBe(10);
  });

  it("exam passed / disabled", () => {
    const rows: AttemptRow[] = [];
    expect(buildPlan(rows, summarize(rows, NOW), { ...DEFAULT_PLAN, examDate: "2026-08-19" }, NOW).status).toBe("exam_passed");
    expect(buildPlan(rows, summarize(rows, NOW), { ...DEFAULT_PLAN, enabled: false }, NOW).status).toBe("disabled");
  });
});
