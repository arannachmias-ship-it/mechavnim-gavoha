import { describe, it, expect } from "vitest";
import { shouldPushMethod } from "./method";
import type { Summary } from "./progress";

const sum = (attempts: number): Summary =>
  ({ topics: { families: { topicId: "families", attempts, correct: 0, mastery: 0, stars: 0 } } } as unknown as Summary);

describe("shouldPushMethod", () => {
  it("דוחף בכניסה ראשונה לנושא", () => {
    expect(shouldPushMethod({ summary: sum(0), topicId: "families" })).toBe(true);
  });
  it("לא דוחף אם כבר תרגלה בנושא", () => {
    expect(shouldPushMethod({ summary: sum(3), topicId: "families" })).toBe(false);
  });
  it("לא דוחף פעמיים – אחרי שהוצג פעם אחת", () => {
    expect(shouldPushMethod({ summary: sum(0), topicId: "families", alreadySeen: true })).toBe(false);
  });
  it("לא דוחף בתרגיל מצילום (אין נושא)", () => {
    expect(shouldPushMethod({ summary: sum(0), topicId: "photo", isCustom: true })).toBe(false);
  });
  it("מחכה לנתונים – בלי summary לא דוחף", () => {
    expect(shouldPushMethod({ summary: null, topicId: "families" })).toBe(false);
  });
  it("נושא שלא מוכר בנתונים נחשב כניסה ראשונה", () => {
    expect(shouldPushMethod({ summary: sum(5), topicId: "parens" })).toBe(true);
  });
});
