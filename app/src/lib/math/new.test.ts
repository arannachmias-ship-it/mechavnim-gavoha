import { describe, it, expect } from "vitest";
import { parseDomainLine, checkLine } from "./engine";
import { generate } from "./generators";
describe("domain", () => {
  it("parses", () => {
    expect(parseDomainLine("x\\ne0,\\ x\\ne-4")).toEqual([0, -4]);
    expect(parseDomainLine("x≠0, x≠4")).toEqual([0, 4]);
    expect(parseDomainLine("x≠±3")).toEqual([3, -3]);
    expect(parseDomainLine("x^2-4")).toBeNull();
  });
  it("hard stop before domain, then flow", () => {
    for (let lv = 1; lv <= 3; lv++) {
      for (let i = 0; i < 15; i++) {
        const ex = generate("alg_frac", lv);
        const r0 = checkLine(ex, [], ex.steps[1].latex);
        expect(r0.status).toBe("wrong");
        expect(r0.mistake).toBe("domain_first");
        const r1 = checkLine(ex, [], ex.steps[0].latex);
        expect(r1.status).toBe("ok");
        const r2 = checkLine(ex, [ex.steps[0].latex], ex.steps[1].latex);
        expect(["ok", "done"]).toContain(r2.status);
        const r3 = checkLine(ex, [ex.steps[0].latex, ex.steps[1].latex], ex.steps[2].latex);
        expect(r3.status).toBe("done");
      }
    }
  });
  it("trinomial & quadratic steps all accepted", () => {
    for (const t of ["trinomial", "quadratic_eq", "order_ops"]) for (let lv = 1; lv <= 3; lv++) for (let i = 0; i < 25; i++) {
      const ex = generate(t, lv);
      const hist: string[] = [];
      for (const s of ex.steps) {
        const r = checkLine(ex, hist, s.latex.replace(/\\ /g, " "));
        if (!["ok", "done", "notprogress"].includes(r.status)) throw new Error(`${t} L${lv} ${ex.promptLatex} step ${s.latex}: ${r.status} ${r.message}`);
        hist.push(s.latex);
      }
      if (ex.kind === "equation" && ex.solutions === "none") {
        expect(checkLine(ex, hist, "אין פתרון").status).toBe("done");
      } else {
        const last = checkLine(ex, hist.slice(0, -1), ex.steps[ex.steps.length - 1].latex.replace(/\\ /g, " "));
        expect(last.status).toBe("done");
      }
    }
  });
  it("divide by x detected", () => {
    for (let i = 0; i < 20; i++) {
      const ex = generate("quadratic_eq", 1);
      const b = ex.solutions as number[];
      const other = b.find((r) => r !== 0)!;
      const r = checkLine(ex, [], `x${-other >= 0 ? "+" : ""}${-other}=0`);
      expect(r.mistake).toBe("divx");
      const r2 = checkLine(ex, [], `x=${other}`);
      expect(r2.mistake).toBe("divx");
    }
  });
});
