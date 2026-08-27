import { describe, it, expect, vi } from "vitest";
import { normalizeFences, prepareFraction, type FenceTarget } from "./fences";

describe("normalizeFences", () => {
  it("מכפלת סוגריים – שני גושים מובנים (המקרה של נגה)", () => {
    expect(normalizeFences("(x-2)(x-5)")).toBe("\\left(x-2\\right)\\left(x-5\\right)");
  });
  it("סוגריים מקוננים", () => {
    expect(normalizeFences("2(3(x+1))")).toBe("2\\left(3\\left(x+1\\right)\\right)");
  });
  it("מה שכבר מובנה נשאר כמו שהוא", () => {
    const s = "\\left(x-2\\right)\\left(x-5\\right)";
    expect(normalizeFences(s)).toBe(s);
  });
  it("תערובת – משלימים רק את מה שחסר", () => {
    expect(normalizeFences("\\left(x-2\\right)(x-5)")).toBe("\\left(x-2\\right)\\left(x-5\\right)");
  });
  it("בתוך שבר שכבר קיים", () => {
    expect(normalizeFences("\\frac{(x+1)}{2}")).toBe("\\frac{\\left(x+1\\right)}{2}");
  });
  it("סוגריים לא מאוזנים – לא נוגעים", () => {
    expect(normalizeFences("(x-2)(x-5")).toBe("(x-2)(x-5");
    expect(normalizeFences(")x(")).toBe(")x(");
  });
  it("בלי סוגריים – בלי שינוי", () => {
    expect(normalizeFences("2x^2+7x")).toBe("2x^2+7x");
    expect(normalizeFences("")).toBe("");
  });
  it("פקודות עם אותיות לא מתבלבלות", () => {
    expect(normalizeFences("\\sqrt{(x+1)}\\cdot(x-1)")).toBe("\\sqrt{\\left(x+1\\right)}\\cdot\\left(x-1\\right)");
  });
});

const field = (latex: string, over: Partial<FenceTarget> = {}): FenceTarget & { value: string } => {
  const f = {
    value: latex,
    getValue: () => f.value,
    setValue: vi.fn((v: string) => {
      f.value = v;
    }),
    position: latex.length,
    lastOffset: latex.length,
    selectionIsCollapsed: true,
    ...over,
  } as unknown as FenceTarget & { value: string };
  return f;
};

describe("prepareFraction", () => {
  it("סמן בסוף וסוגריים שטוחים – מסדרים", () => {
    const f = field("(x-2)(x-5)");
    expect(prepareFraction(f)).toBe(true);
    expect(f.value).toBe("\\left(x-2\\right)\\left(x-5\\right)");
  });
  it("סמן באמצע – לא נוגעים (שלא יקפוץ לה הסמן)", () => {
    const f = field("(x-2)(x-5)", { position: 3 });
    expect(prepareFraction(f)).toBe(false);
    expect(f.value).toBe("(x-2)(x-5)");
  });
  it("יש בחירה – לא נוגעים", () => {
    const f = field("(x-2)", { selectionIsCollapsed: false });
    expect(prepareFraction(f)).toBe(false);
  });
  it("אין מה לתקן – לא כותבים מחדש את השדה", () => {
    const f = field("2x+7");
    expect(prepareFraction(f)).toBe(false);
    expect(f.setValue).not.toHaveBeenCalled();
  });
});
