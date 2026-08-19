import { describe, it, expect } from "vitest";
import { evalCalc, asFraction } from "./calc";

describe("calculator", () => {
  it("basic ops with the keys the app produces", () => {
    expect(evalCalc("12−3×(5−2)²÷9+4").value).toBe(13);
    expect(evalCalc("7÷2").text).toBe("3.5");
    expect(evalCalc("√25").value).toBe(5);
    expect(evalCalc("√(9+16)").value).toBe(5);
    expect(evalCalc("2^10").value).toBe(1024);
    expect(evalCalc("(-3)²").value).toBe(9);
    expect(evalCalc("-3²").value).toBe(-9);
    expect(evalCalc("1÷3").text).toBe("0.3333333333");
  });
  it("fractions and open parens", () => {
    expect(evalCalc("3÷4").frac).toBe("3/4");
    expect(evalCalc("2×(3+4").value).toBe(14);
    expect(asFraction(0.5)).toBe("1/2");
    expect(asFraction(2)).toBeUndefined();
  });
  it("errors", () => {
    expect(evalCalc("5÷0").ok).toBe(false);
    expect(evalCalc("2x+1").ok).toBe(false);
    expect(evalCalc("").ok).toBe(false);
  });
});
