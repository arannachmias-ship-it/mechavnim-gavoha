import { describe, it, expect } from "vitest";
import { taskFocus } from "./todayTask";
import type { Plan, PlanTask } from "./plan";

const task = (typeId: string, exercises: number, done: number): PlanTask => ({ typeId, topicId: "families", kind: "learn", minutes: exercises * 3, exercises, done });
const plan = (over: Partial<Plan>): Plan =>
  ({
    status: "on_track",
    todayTasks: [],
    days: [{ date: "2026-08-23", label: "היום", off: false, minutes: 40, tasks: [], actualMinutes: 0, actualCount: 0 }],
    ...over,
  }) as unknown as Plan;

describe("taskFocus", () => {
  it("באמצע המכסה של הנושא – יעד, נעשה, ולא הושלם", () => {
    const f = taskFocus(plan({ todayTasks: [task("like_terms", 6, 2), task("mono_mul", 4, 0)] }), "like_terms");
    expect(f).toMatchObject({ active: true, inPlan: true, target: 6, done: 2, complete: false, dayDone: false });
    expect(f.next?.typeId).toBe("mono_mul");
  });
  it("סיימה את המכסה – complete, והמשימה הבאה היא נושא אחר", () => {
    const f = taskFocus(plan({ todayTasks: [task("like_terms", 6, 6), task("mono_mul", 4, 1)] }), "like_terms");
    expect(f.complete).toBe(true);
    expect(f.done).toBe(6);
    expect(f.next?.typeId).toBe("mono_mul");
  });
  it("עשתה יותר מהיעד – done לא עובר את היעד, ועדיין complete", () => {
    const f = taskFocus(plan({ todayTasks: [task("like_terms", 6, 9)] }), "like_terms");
    expect(f.done).toBe(6);
    expect(f.complete).toBe(true);
    expect(f.next).toBeNull();
    expect(f.dayDone).toBe(true);
  });
  it("נושא שלא במשימת היום – inPlan=false, ומצביעים על המשימה הפתוחה", () => {
    const f = taskFocus(plan({ todayTasks: [task("mono_mul", 4, 0)] }), "distribute");
    expect(f).toMatchObject({ active: true, inPlan: false, complete: false });
    expect(f.next?.typeId).toBe("mono_mul");
  });
  it("כל המשימות סגורות – dayDone, בלי נושא הבא", () => {
    const f = taskFocus(plan({ todayTasks: [task("like_terms", 6, 6), task("mono_mul", 4, 4)] }), "like_terms");
    expect(f.dayDone).toBe(true);
    expect(f.next).toBeNull();
  });
  it("אין תוכנית / מכובה / יום חופש / אחרי המבחן – לא דוחפים כלום", () => {
    expect(taskFocus(null, "like_terms").active).toBe(false);
    expect(taskFocus(plan({ status: "disabled", todayTasks: [task("mono_mul", 4, 0)] }), "like_terms").active).toBe(false);
    expect(taskFocus(plan({ status: "exam_passed", todayTasks: [task("mono_mul", 4, 0)] }), "like_terms").active).toBe(false);
    const off = plan({ todayTasks: [task("mono_mul", 4, 0)] });
    off.days[0].off = true;
    expect(taskFocus(off, "like_terms").active).toBe(false);
  });
});
