import { describe, it, expect } from "vitest";
import { exerciseFromPhoto, latexToPoly } from "./fromLatex";
import { checkLine } from "./engine";

describe("fromLatex", () => {
  it("expands polynomial expressions", () => {
    const r = exerciseFromPhoto({ latex: "3\\left(x+2\\right)^{2}-4x", kind: "expr", task: "expand" });
    expect("ex" in r).toBe(true);
    if ("ex" in r) {
      expect(r.ex.finalPlain).toBeTruthy();
      expect(checkLine(r.ex, [], "3(x^2+4x+4)-4x").status).toBe("ok");
      expect(checkLine(r.ex, ["3(x^2+4x+4)-4x"], "3x^2+8x+12").status).toBe("done");
      expect(checkLine(r.ex, [], "3x^2+8x+11").status).toBe("wrong");
    }
  });
  it("numeric order of ops", () => {
    const r = exerciseFromPhoto({ latex: "12-3\\cdot\\left(5-2\\right)^{2}:9+4", kind: "expr", task: "compute" });
    if (!("ex" in r)) throw new Error(r.unsupported);
    expect(r.ex.finalLatex).toBe("13");
    expect(checkLine(r.ex, [], "12-27:9+4").status).toBe("ok");
    expect(checkLine(r.ex, ["12-27:9+4"], "13").status).toBe("done");
  });
  it("factors trinomials incl a≠1 and common factor", () => {
    for (const [lx, fin] of [["x^{2}-7x+12", "(x-3)*(x-4)"], ["2x^{2}+7x+3", "(2x+1)*(x+3)"], ["3x^{2}+12x-63", "3*(x+7)*(x-3)"], ["x^{2}-6x", "x*(x-6)"], ["4x^{2}-25", "(2x+5)*(2x-5)"]] as const) {
      const r = exerciseFromPhoto({ latex: lx, kind: "expr", task: "factor" });
      if (!("ex" in r)) throw new Error(lx + " " + r.unsupported);
      const res = checkLine(r.ex, [], fin);
      expect(res.status, lx + " -> " + res.message).toBe("done");
    }
  });
  it("equations linear/quadratic/none", () => {
    const r = exerciseFromPhoto({ latex: "3\\left(x+5\\right)=45+8x", kind: "equation", task: "solve" });
    if (!("ex" in r)) throw new Error(r.unsupported);
    expect(r.ex.solutions).toEqual([-6]);
    expect(checkLine(r.ex, [], "3x+15=45+8x").status).toBe("ok");
    expect(checkLine(r.ex, ["3x+15=45+8x"], "x=-6").status).toBe("done");
    const q = exerciseFromPhoto({ latex: "x^{2}-6x=0", kind: "equation", task: "solve" });
    if (!("ex" in q)) throw new Error(q.unsupported);
    expect(checkLine(q.ex, [], "x=6").mistake).toBe("divx");
    expect(checkLine(q.ex, [], "x=0, x=6").status).toBe("done");
    const n = exerciseFromPhoto({ latex: "x^{2}+2x+5=0", kind: "equation", task: "solve" });
    if (!("ex" in n)) throw new Error(n.unsupported);
    expect(n.ex.solutions).toBe("none");
    const fr = exerciseFromPhoto({ latex: "\\frac{x+8}{4}=\\frac{4+3x}{7}", kind: "equation", task: "solve" });
    if (!("ex" in fr)) throw new Error(fr.unsupported);
    expect(fr.ex.solutions).toEqual([8]);
  });
  it("systems", () => {
    const r = exerciseFromPhoto({ latex: "\\begin{cases}x+y=7\\\\5y+3x=17\\end{cases}", kind: "system", task: "solve" });
    if (!("ex" in r)) throw new Error(r.unsupported);
    expect(r.ex.solutionMap).toEqual({ x: 9, y: -2 });
    expect(checkLine(r.ex, [], "5x+5y=35").status).toBe("ok");
    expect(checkLine(r.ex, ["5x+5y=35"], "2x=18").status).toBe("ok");
    expect(checkLine(r.ex, ["5x+5y=35", "2x=18"], "x=9, y=-2").status).toBe("done");
  });
  it("unsupported gracefully", () => {
    expect("unsupported" in exerciseFromPhoto({ latex: "\\frac{1}{x}+\\frac{2}{x+1}", kind: "expr", task: "simplify" })).toBe(true);
    expect(latexToPoly("\\sqrt{x}")).toBeNull();
  });
});
