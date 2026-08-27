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
  it("הסדר החדש: פירוק לגושים → תחום הצבה → פלאש-דאון", () => {
    for (let lv = 1; lv <= 3; lv++) {
      for (let i = 0; i < 12; i++) {
        const ex = generate("alg_frac", lv);
        const [factored, domain, final] = ex.steps.map((s) => s.latex);
        // פירוק לגושים בלי תחום הצבה – מותר, וזה מה שמגלה מי אסור בכניסה
        const r1 = checkLine(ex, [], factored);
        expect(r1.status).toBe("ok");
        expect(r1.mistake).toBeUndefined();
        // תחום הצבה נקרא מהמכנה המפורק
        const r2 = checkLine(ex, [factored], domain);
        expect(r2.status).toBe("ok");
        // צמצום – ומסיימים
        const r3 = checkLine(ex, [factored, domain], final);
        expect(r3.status).toBe("done");
      }
    }
  });
  it("צמצמה לפני שכתבה את השומר – לא טעות, רק מבקשים את תחום ההצבה", () => {
    for (let lv = 1; lv <= 3; lv++) {
      for (let i = 0; i < 12; i++) {
        const ex = generate("alg_frac", lv);
        const [factored, domain, final] = ex.steps.map((s) => s.latex);
        const r1 = checkLine(ex, [factored], final);
        expect(r1.status).toBe("ok"); // מתקבל, אבל עוד לא "סיימנו"
        expect(r1.mistake).toBeUndefined();
        expect(r1.message).toContain("x≠");
        const r2 = checkLine(ex, [factored, final], domain);
        expect(r2.status).toBe("done");
      }
    }
  });
  it("גם הסדר הישן עובד: תחום הצבה ראשון", () => {
    for (let i = 0; i < 12; i++) {
      const ex = generate("alg_frac", 2);
      const [factored, domain, final] = ex.steps.map((s) => s.latex);
      expect(checkLine(ex, [], domain).status).toBe("ok");
      expect(checkLine(ex, [domain], factored).status).toBe("ok");
      expect(checkLine(ex, [domain, factored], final).status).toBe("done");
    }
  });
  it("תחום הצבה שגוי או חסר עדיין נתפס", () => {
    for (let i = 0; i < 12; i++) {
      const ex = generate("alg_frac", 1);
      const ok = ex.excluded!;
      const missing = checkLine(ex, [], `x≠${ok[0]}`);
      if (ok.length > 1) {
        expect(missing.status).toBe("wrong");
        expect(missing.mistake).toBe("domain_missing");
      }
      const bogus = 999;
      const wrong = checkLine(ex, [], ok.map((e) => `x≠${e}`).concat(`x≠${bogus}`).join(", "));
      expect(wrong.status).toBe("wrong");
      expect(wrong.mistake).toBe("domain_wrong");
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

describe("שני פתרונות בשורה אחת", () => {
  it("x=0,4 מתקבל בדיוק כמו x=0, x=4", () => {
    const ex = generate("quadratic_eq", 1);
    const sol = ex.solutions as number[];
    if (sol.length !== 2) return;
    const [a, b] = sol;
    // בדיוק כפי ש-MathLive מייצר את השורה (כולל רווח לטקסי)
    for (const line of [`x=${a},${b}`, `x=${a}, ${b}`, `x=${a},\\ ${b}`, `x=${a}, x=${b}`, `x_1=${a}, x_2=${b}`, `x=${a}\\ ,\\ ${b}`]) {
      const r = checkLine(ex, [], line);
      expect(r.status, line).toBe("done");
    }
  });
  it("רשימה בלי x= בכלל, או ערך שגוי – לא עוברים", () => {
    const ex = generate("quadratic_eq", 1);
    const sol = ex.solutions as number[];
    expect(checkLine(ex, [], `x=${sol[0]},${sol[0] + 17}`).status).not.toBe("done");
  });
});

describe("שני פתרונות בשתי שורות", () => {
  it("x=0 בשורה אחת ו-x=-1 בשורה הבאה = תשובה שלמה", () => {
    for (let i = 0; i < 20; i++) {
      const ex = generate("quadratic_eq", 1);
      const sol = ex.solutions as number[];
      if (!Array.isArray(sol) || sol.length !== 2) continue;
      const r1 = checkLine(ex, [], `x=${sol[0]}`);
      expect(r1.status).toBe("ok");
      expect(r1.message).toContain("פתרון אחד");
      const r2 = checkLine(ex, [`x=${sol[0]}`], `x=${sol[1]}`);
      expect(r2.status).toBe("done");
    }
  });
  it("אחרי ששני השורשים נכתבו – לא מתלוננים שחסר x=0", () => {
    for (let i = 0; i < 20; i++) {
      const ex = generate("quadratic_eq", 1);
      const sol = ex.solutions as number[];
      if (!Array.isArray(sol) || sol.length !== 2 || !sol.some((s) => Math.abs(s) < 1e-9)) continue;
      const zero = sol.find((s) => Math.abs(s) < 1e-9)!;
      const other = sol.find((s) => Math.abs(s) > 1e-9)!;
      const r = checkLine(ex, [`x=${zero}`], `x=${other}`);
      expect(r.status).toBe("done");
      expect(r.message).not.toContain("חילקת");
    }
  });
});
