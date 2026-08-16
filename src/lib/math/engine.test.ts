import { describe, it, expect } from "vitest";
import { GENERATORS, generate } from "./generators";
import { checkLine } from "./engine";
import { normalizeInput, exprEquivalent, solutionSet, parseExpr } from "./check";

describe("normalizeInput", () => {
  it("handles latex", () => {
    expect(normalizeInput("\\frac{3x+21}{3}")).toBe("((3*x+21)/(3))");
    expect(normalizeInput("2x^{2}\\cdot xy")).toBe("2*x^(2)*x*y");
    expect(normalizeInput("\\left(x+3\\right)\\left(x-7\\right)")).toBe("(x+3)*(x-7)");
    expect(normalizeInput("-\\left(2y-2t\\right)")).toBe("-(2*y-2*t)");
    expect(normalizeInput("√8")).toBe("sqrt8".replace("sqrt8", "sqrt8")); // sqrt without parens: mathjs needs parens
  });
});

describe("equivalence", () => {
  it("expr", () => {
    expect(exprEquivalent("(x+3)(x-7)", "x^2-4x-21")).toBe(true);
    expect(exprEquivalent("(x+3)(x-7)", "x^2-21")).toBe(false);
    expect(exprEquivalent("(3x+21)/3", "x+7")).toBe(true);
    expect(exprEquivalent("(2x^2-2x)/(4-4x)", "-x/2")).toBe(true);
  });
  it("solution sets", () => {
    expect(solutionSet("3x+5=20").kind).toBe("finite");
    const s = solutionSet("(x+6)^2-10x=x(x+3)");
    expect(s.kind === "finite" && Math.abs(s.roots[0] - 36) < 1e-6).toBe(true);
    expect(solutionSet("2x+5=2x+5").kind).toBe("all");
    expect(solutionSet("2x+5=2x+7").kind).toBe("none");
    const q = solutionSet("x^2-8x+12=0");
    expect(q.kind === "finite" && q.roots.length === 2).toBe(true);
    const r = solutionSet("(x^2-4)/(x-2)=30");
    expect(r.kind === "finite" && r.roots.length === 1 && Math.abs(r.roots[0] - 28) < 1e-6).toBe(true);
    const t = solutionSet("3=5(x-2)");
    expect(t.kind === "finite" && Math.abs(t.roots[0] - 2.6) < 1e-9).toBe(true);
  });
});

describe("generators produce consistent exercises", () => {
  for (const [id, gen] of Object.entries(GENERATORS)) {
    for (const level of [1, 2, 3]) {
      it(`${id} L${level}`, () => {
        for (let i = 0; i < 25; i++) {
          const ex = generate(id, level);
          void gen;
          expect(ex.promptLatex.length).toBeGreaterThan(0);
          if (ex.kind === "expr") {
            expect(parseExpr(ex.originalPlain!)).not.toBeNull();
            expect(parseExpr(ex.finalPlain!)).not.toBeNull();
            expect(exprEquivalent(ex.originalPlain!, ex.finalPlain!)).toBe(true);
            // final answer typed as latex must be accepted as done
            const res = checkLine(ex, [], ex.finalLatex);
            expect(res.status, `${id} L${level} final ${ex.finalLatex} -> ${res.message}`).toBe("done");
            // each canonical step accepted
            for (const s of ex.steps) {
              const r = checkLine(ex, [], s.latex);
              expect(["ok", "done", "same"], `${id} step ${s.latex} -> ${r.status} ${r.message}`).toContain(r.status);
            }
          } else if (ex.kind === "equation") {
            const res = checkLine(ex, [], ex.finalLatex.replace(/\\text\{כל \} x/, "כל x").replace(/\\text\{אין פתרון\}/, "אין פתרון").replace(/\\ /g, " "));
            expect(res.status, `${id} L${level} final ${ex.finalLatex} -> ${res.message}`).toBe("done");
            for (const s of ex.steps) {
              const r = checkLine(ex, [], s.latex.replace(/\\ /g, " "));
              expect(["ok", "done", "same"], `${id} L${level} step ${s.latex} (prompt ${ex.promptLatex}) -> ${r.status} ${r.message} ${r.detail ?? ""}`).toContain(r.status);
            }
          } else {
            const hist: string[] = [];
            for (const s of ex.steps) {
              const r = checkLine(ex, hist, s.latex.replace(/\\ /g, " "));
              expect(["ok", "done", "same"], `${id} L${level} step ${s.latex} -> ${r.status} ${r.message}`).toContain(r.status);
              hist.push(s.latex);
            }
            const last = checkLine(ex, hist.slice(0, -1), ex.steps[ex.steps.length - 1].latex.replace(/\\ /g, " "));
            expect(last.status).toBe("done");
          }
        }
      });
    }
  }
});

describe("wrong answers rejected", () => {
  it("expr wrong", () => {
    const ex = generate("binomial", 1);
    expect(checkLine(ex, [], "x^2+1000").status).toBe("wrong");
  });
  it("equation wrong", () => {
    const ex = generate("linear_eq", 1);
    expect(checkLine(ex, [], "x=1000").status).toBe("wrong");
    expect(checkLine(ex, [], "3x=999999").status).toBe("wrong");
  });
});
