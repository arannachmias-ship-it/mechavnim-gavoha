import { describe, it, expect } from "vitest";
import { isIntentionalCommit, COMMIT_INTENT_MS } from "./commit";

const base = { intentAt: 0, now: 10_000, hidden: false, focused: false };

describe("isIntentionalCommit", () => {
  it("איבוד פוקוס לכפתור באפליקציה (מחשבון/רמז) – לא שולחים", () => {
    expect(isIntentionalCommit(base)).toBe(false);
  });
  it("לחיצה על ↵ – שולחים", () => {
    expect(isIntentionalCommit({ ...base, intentAt: 9_800 })).toBe(true);
  });
  it("↵ ישן מדי (change שהגיע מאיבוד פוקוס מאוחר יותר) – לא שולחים", () => {
    expect(isIntentionalCommit({ ...base, intentAt: 10_000 - COMMIT_INTENT_MS - 1 })).toBe(false);
  });
  it("השדה נשאר ממוקד – זאת שליחה מכוונת", () => {
    expect(isIntentionalCommit({ ...base, focused: true })).toBe(true);
  });
  it("המסך ברקע – אף פעם לא שולחים, גם אם היה ↵ וגם אם יש פוקוס", () => {
    expect(isIntentionalCommit({ ...base, hidden: true, focused: true, intentAt: 9_900 })).toBe(false);
  });
});
