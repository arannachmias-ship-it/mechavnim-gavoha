import { describe, it, expect } from "vitest";
import { missionOf, examReadinessPercent, nudgeText } from "./mission";
import type { Plan, PlanTask, TypeNeed } from "./plan";

const task = (typeId: string, exercises: number, done: number): PlanTask => ({ typeId, topicId: "families", kind: "learn", minutes: exercises * 3, exercises, done });
const need = (typeId: string, readiness: TypeNeed["readiness"], mastery: number): TypeNeed => ({ typeId, topicId: "families", title: typeId, mastery, stars: 0, attempts: readiness === "new" ? 0 : 5, readiness, needEx: 5, needMin: 15 });

const plan = (over: Partial<Plan>): Plan =>
  ({
    status: "on_track",
    daysLeft: 10,
    avgMinPerEx: 3,
    todayTasks: [],
    days: [{ date: "2026-08-22", label: "היום", off: false, minutes: 40, tasks: [], actualMinutes: 0, actualCount: 0 }],
    needs: [],
    ...over,
  }) as unknown as Plan;

describe("missionOf", () => {
  it("יום פתוח: יעד, נעשה, נשאר, אחוז וכפתור אל המשימה הפתוחה הראשונה", () => {
    const m = missionOf(plan({ todayTasks: [task("like_terms", 6, 6), task("mono_mul", 4, 1)] }));
    expect(m.state).toBe("open");
    expect(m.targetEx).toBe(10);
    expect(m.doneEx).toBe(7);
    expect(m.remainEx).toBe(3);
    expect(m.remainMinutes).toBe(9);
    expect(m.pct).toBeCloseTo(0.7);
    expect(m.firstOpenTypeId).toBe("mono_mul");
  });
  it("done כשהיעד הושלם – גם אם הסטטוס הכללי עדיין on_track", () => {
    const m = missionOf(plan({ todayTasks: [task("like_terms", 5, 5)] }));
    expect(m.state).toBe("done");
    expect(m.pct).toBe(1);
    expect(m.firstOpenTypeId).toBeNull();
  });
  it("עשתה יותר מהיעד – עדיין done ו-100%, לא 120%", () => {
    const m = missionOf(plan({ todayTasks: [task("like_terms", 5, 9)] }));
    expect(m.state).toBe("done");
    expect(m.doneEx).toBe(5);
    expect(m.pct).toBe(1);
  });
  it("יום חופש", () => {
    const p = plan({ todayTasks: [task("like_terms", 5, 0)] });
    p.days[0].off = true;
    expect(missionOf(p).state).toBe("off");
  });
  it("אין משימות היום", () => {
    expect(missionOf(plan({})).state).toBe("empty");
  });
  it("אחרי המבחן / מכובה", () => {
    expect(missionOf(plan({ status: "exam_passed" })).state).toBe("exam_passed");
    expect(missionOf(plan({ status: "disabled" })).state).toBe("disabled");
  });
});

describe("examReadinessPercent", () => {
  it("הכול מוכן = 100", () => {
    expect(examReadinessPercent(plan({ needs: [need("a", "ready", 0.9), need("b", "ready", 0.8)] }))).toBe(100);
  });
  it("הכול חדש = 0", () => {
    expect(examReadinessPercent(plan({ needs: [need("a", "new", 0), need("b", "new", 0)] }))).toBe(0);
  });
  it("סוג בתהליך נספר לפי mastery ביחס לרף 0.8", () => {
    // 0.4/0.8 = 0.5 → סוג אחד כזה מתוך שניים עם מוכן = (1 + 0.5)/2 = 75%
    expect(examReadinessPercent(plan({ needs: [need("a", "ready", 0.9), need("b", "started", 0.4)] }))).toBe(75);
  });
  it("סוג לא-מוכן לעולם לא תורם יותר מ-0.9 – האחוז המלא עובר דרך 'מוכן' אמיתי", () => {
    expect(examReadinessPercent(plan({ needs: [need("a", "almost", 0.79)] }))).toBe(90);
  });
});

describe("nudgeText", () => {
  const tt = (id: string) => ({ like_terms: "איחוד משפחות" })[id] ?? id;
  it("עוד לא נכנסה היום – הזמנה עם היעד והנושא הראשון", () => {
    const s = nudgeText(plan({ todayTasks: [task("like_terms", 8, 0)] }), tt);
    expect(s).toContain("8 תרגילים");
    expect(s).toContain("איחוד משפחות");
    expect(s).toContain("עוד 10 ימים");
  });
  it("התחילה ולא סיימה – עידוד לסגור את היום", () => {
    const s = nudgeText(plan({ todayTasks: [task("like_terms", 8, 5)] }), tt);
    expect(s).toContain("5/8");
    expect(s).toContain("3 תרגילים");
  });
  it("סגרה את היום – מילה טובה, בלי נדנוד", () => {
    const s = nudgeText(plan({ todayTasks: [task("like_terms", 8, 8)] }), tt);
    expect(s).toContain("גאה בך");
  });
  it("השם נכתב נגה – בכל מצב, ובלי כינויים", () => {
    for (const t of [task("like_terms", 8, 0), task("like_terms", 8, 5), task("like_terms", 8, 8)]) {
      const s = nudgeText(plan({ todayTasks: [t] }), tt);
      expect(s).toContain("נגה");
      expect(s).not.toMatch(/נוג/);
    }
  });
});
