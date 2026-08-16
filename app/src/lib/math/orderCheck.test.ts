import { describe, it, expect } from "vitest";
import { checkOrder } from "./orderCheck";
import { checkLine } from "./engine";
import type { Exercise } from "./types";

const ord = (a: string, b: string) => checkOrder(a, b);

describe("order of operations – process check", () => {
  it("left to right in a +/- chain", () => {
    expect(ord("30-19+3", "11+3").inOrder).toBe(true);
    expect(ord("30-19+3", "14").inOrder).toBe(true);
    const bad = ord("30-19+3", "30-16");
    expect(bad.inOrder).toBe(false);
    expect(bad.expectedFirst).toBe("30−19=11");
  });
  it("left to right in a */ chain", () => {
    expect(ord("8:2\\cdot 3", "4\\cdot 3").inOrder).toBe(true);
    expect(ord("8:2\\cdot 3", "12").inOrder).toBe(true);
    expect(ord("8:2\\cdot 3", "8:6").inOrder).toBe(false);
  });
  it("snobs first inside a chain", () => {
    expect(ord("30-19+4\\cdot 9", "30-19+36").inOrder).toBe(true);
    expect(ord("30-19+4\\cdot 9", "11+36").inOrder).toBe(true);
    expect(ord("30-19+4\\cdot 9", "11+4\\cdot 9").inOrder).toBe(false);
    expect(ord("30-19+4\\cdot 9", "47").inOrder).toBe(true);
  });
  it("parentheses and powers", () => {
    const p = "30-4\\cdot\\left(7-2\\right)^{2}:5+1";
    expect(ord(p, "30-4\\cdot 5^{2}:5+1").inOrder).toBe(true);
    expect(ord(p, "30-4\\cdot 25:5+1").inOrder).toBe(true);
    expect(ord(p, "30-100:5+1").inOrder).toBe(true);
    expect(ord(p, "30-20+1").inOrder).toBe(true);
    expect(ord(p, "10+1").inOrder).toBe(true);
    expect(ord(p, "11").inOrder).toBe(true);
    expect(ord(p, "30-4\\cdot 5^{2}:6").inOrder).toBe(false); // grouped 5+1 from the right (also wrong value)
    expect(ord(p, "30-21").inOrder).toBe(false); // 20+1 grouped from the right
    expect(ord(p, "30-4\\cdot 5:5+1").inOrder).toBe(false); // skipped the power
  });
  it("independent blocks in any order", () => {
    expect(ord("4\\cdot 9-2\\cdot 5", "4\\cdot 9-10").inOrder).toBe(true);
    expect(ord("4\\cdot 9-2\\cdot 5", "36-2\\cdot 5").inOrder).toBe(true);
    expect(ord("\\left(7-2\\right)^{2}+\\left(3+1\\right)^{2}", "25+\\left(3+1\\right)^{2}").inOrder).toBe(true);
  });
  it("negative numbers and even powers", () => {
    expect(ord("12:4\\cdot 3-2\\cdot\\left(-3\\right)^{2}", "12:4\\cdot 3-2\\cdot 9").inOrder).toBe(true);
    expect(ord("12:4\\cdot 3-2\\cdot\\left(-3\\right)^{2}", "3\\cdot 3-2\\cdot 9").inOrder).toBe(true);
    expect(ord("12:4\\cdot 3-2\\cdot\\left(-3\\right)^{2}", "9-18").inOrder).toBe(true);
    expect(ord("5-8+3", "-3+3").inOrder).toBe(true);
    expect(ord("5-8+3", "5-5").inOrder).toBe(false);
  });
  it("unknown for algebra", () => {
    expect(ord("2x+3x", "5x").unknown).toBe(true);
  });
});

describe("engine: amber warning on correct-but-out-of-order line", () => {
  const ex: Exercise = {
    id: "t",
    typeId: "order_ops",
    topicId: "order_ops",
    kind: "expr",
    level: 1,
    instruction: "",
    promptLatex: "30-19+3",
    originalPlain: "30-19+3",
    finalPlain: "14",
    finalLatex: "14",
    finalForm: "any",
    stages: [{ name: "", hint1: "", hint2: "" }],
    steps: [{ latex: "14", stage: 1, note: "" }],
    stageOf: () => 0,
    traps: [],
  };
  it("accepts with warn + mistake key 'order'", () => {
    const r = checkLine(ex, [], "30-16");
    expect(r.status).toBe("ok");
    expect(r.warn).toMatch(/30−19=11/);
    expect(r.mistake).toBe("order");
    const good = checkLine(ex, [], "11+3");
    expect(good.status).toBe("ok");
    expect(good.warn).toBeUndefined();
    const fin = checkLine(ex, ["11+3"], "14");
    expect(fin.status).toBe("done");
    expect(fin.warn).toBeUndefined();
  });
  it("wrong value still red (pair trap)", () => {
    const r = checkLine(ex, [], "30-22");
    expect(r.status).toBe("wrong");
  });
});
