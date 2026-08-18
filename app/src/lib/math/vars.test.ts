import { describe, it, expect } from "vitest";
import { GENERATORS, generate } from "./generators";
import { exerciseVariables, keyboardVariables, lettersIn } from "./vars";
import { buildLayout } from "./keyboard";

/** כל האותיות שמופיעות על המקלדת שנבנתה */
function keysOf(vars: string[]): Set<string> {
  const rows = buildLayout(vars)[0].rows as { latex?: string; label?: string }[][];
  const out = new Set<string>();
  for (const row of rows) for (const k of row) if (k.latex && /^[a-zA-Z]$/.test(k.latex)) out.add(k.latex);
  return out;
}

describe("lettersIn", () => {
  it("ignores latex commands and Hebrew", () => {
    expect(lettersIn("\\frac{3m+2n}{m}").sort()).toEqual(["m", "n"]);
    expect(lettersIn("\\text{אין פתרון}")).toEqual([]);
    expect(lettersIn("\\begin{cases}2x+y=6\\\\x+y=2\\end{cases}").sort()).toEqual(["x", "y"]);
    expect(lettersIn("x_{1,2}=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}").sort()).toEqual(["a", "b", "c", "x"]);
  });
});

describe("the math keyboard always has every letter the exercise uses", () => {
  const types = Object.keys(GENERATORS);
  for (const t of types) {
    for (const lv of [1, 2, 3]) {
      it(`${t} level ${lv}`, () => {
        for (let i = 0; i < 25; i++) {
          const ex = generate(t, lv);
          const need = exerciseVariables(ex);
          const keys = keysOf(need);
          for (const v of need) expect(keys.has(v), `חסר מקש "${v}" בתרגיל ${ex.promptLatex}`).toBe(true);
          expect(keys.size).toBeGreaterThanOrEqual(6);
        }
      });
    }
  }
  it("keeps the common letters when the exercise needs few", () => {
    expect(keyboardVariables(["x"])).toEqual(["x", "y", "a", "b", "t", "m"]);
    expect(keyboardVariables(["m", "n"])).toEqual(["m", "n", "x", "y", "a", "b"]);
  });
  it("never drops a letter, even with many variables", () => {
    const many = ["p", "q", "r", "s", "u", "v", "w"];
    const keys = keysOf(many);
    for (const v of many) expect(keys.has(v)).toBe(true);
  });
});
