import { describe, it, expect } from "vitest";
import { generate, generateWithSeed, GENERATORS } from "./generators";

const strip = (ex: unknown) =>
  JSON.stringify(ex, (k, v) => (k === "id" || k === "stageOf" ? undefined : typeof v === "function" ? undefined : v));

describe("seeded generation is reproducible (needed for resuming an interrupted exercise)", () => {
  const types = Object.keys(GENERATORS);
  it("has generators", () => expect(types.length).toBeGreaterThan(5));
  for (const t of types) {
    for (const lv of [1, 2, 3]) {
      it(`${t} level ${lv}: same seed → same exercise`, () => {
        const { ex, seed } = generateWithSeed(t, lv);
        const again = generate(t, lv, seed);
        expect(strip(again)).toBe(strip(ex));
        expect(again.promptLatex).toBe(ex.promptLatex);
        expect(again.finalLatex).toBe(ex.finalLatex);
      });
    }
  }
  it("different seeds usually differ", () => {
    const a = generateWithSeed("like_terms", 2);
    let diff = 0;
    for (let i = 0; i < 8; i++) if (generateWithSeed("like_terms", 2).ex.promptLatex !== a.ex.promptLatex) diff++;
    expect(diff).toBeGreaterThan(4);
  });
});
