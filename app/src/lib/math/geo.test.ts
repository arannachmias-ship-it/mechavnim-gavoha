import { describe, it, expect } from "vitest";
import { generate } from "./generators";
import { checkLine } from "./engine";
import { extractPoints, geoChecklist, segKey } from "./geo";
import type { Exercise } from "./types";

const fmt = (n: number) => {
  if (Number.isInteger(n)) return String(n);
  for (let d = 2; d <= 24; d++) if (Math.abs(Math.round(n * d) / d - n) < 1e-9) return `\\frac{${Math.round(n * d)}}{${d}}`;
  return String(Math.round(n * 1000) / 1000);
};
const ask = (ex: Exercise, key: string) => ex.asks!.find((a) => a.key === key)!;

describe("geo – parsing", () => {
  it("extracts points in student latex", () => {
    expect(extractPoints("(3,0)")!.points).toEqual([{ x: 3, y: 0 }]);
    expect(extractPoints("M=(\\frac{1+7}{2},\\frac{3+5}{2})")!.points).toEqual([{ x: 4, y: 4 }]);
    expect(extractPoints("(1,3),(3,7)")!.points).toEqual([
      { x: 1, y: 3 },
      { x: 3, y: 7 },
    ]);
    expect(extractPoints("(-2.5,0)")!.points).toEqual([{ x: -2.5, y: 0 }]);
    expect(extractPoints("m=2")).toBeNull();
  });
});

describe("geo – פונקציה קווית", () => {
  it("line_read: full student flow, traps and checklist", () => {
    for (let s = 1; s < 30; s++) {
      const ex = generate("line_read", 1, s);
      const m = ex.params!.m,
        b = ex.params!.b;
      const px = ask(ex, "Px").x!;
      // trap: m confused with b
      if (b !== m) expect(checkLine(ex, [], `m=${fmt(b)}`).status).toBe("wrong");
      const r1 = checkLine(ex, [], `m=${fmt(m)}`);
      expect(r1.status).toBe("ok");
      const h = [`m=${fmt(m)}`];
      // x=0 as an intermediate thought
      expect(checkLine(ex, h, "x=0").status).toBe("ok");
      // wall/floor mix-up
      if (b !== px) expect(checkLine(ex, h, `\\left(${fmt(b)},0\\right)`).status).toBe("wrong");
      const r2 = checkLine(ex, h, `\\left(0,${fmt(b)}\\right)`);
      expect(r2.status).toBe("ok");
      h.push(`\\left(0,${fmt(b)}\\right)`);
      expect(geoChecklist(ex, h).map((c) => c.done)).toEqual([true, true, false]);
      // an equation on the way: 0 = m x + b
      expect(checkLine(ex, h, `0=${fmt(m)}x+${fmt(b)}`).status).toBe("ok");
      expect(checkLine(ex, h, `x=${fmt(px)}`).status).toBe("ok");
      // sign trap on the x-intercept
      expect(checkLine(ex, h, `(${fmt(-px)},0)`).status).toBe("wrong");
      const r3 = checkLine(ex, h, `(${fmt(px)},0)`);
      expect(r3.status, `${ex.promptLatex} -> ${r3.message}`).toBe("done");
    }
  });
  it("line_read L3: y must be isolated to count as the equation", () => {
    const ex = generate("line_read", 3, 7);
    const r = checkLine(ex, [], ex.promptLatex);
    expect(["ok", "same"]).toContain(r.status);
    expect(geoChecklist(ex, [ex.promptLatex])[0].done).toBe(false);
  });
  it("line_through: slope flip trap, y=mx+b with unknown b, and done", () => {
    for (let s = 1; s < 30; s++) {
      const ex = generate("line_through", 1, s);
      const m = ex.params!.m,
        b = ex.params!.b;
      const [A, B] = ex.plot!.points!;
      if (Math.abs(1 / m) !== Math.abs(m)) {
        const flip = checkLine(ex, [], `m=\\frac{${B.x}-${A.x}}{${B.y}-${A.y}}`);
        expect(flip.status).toBe("wrong");
        expect(flip.mistake).toBe("slope_flip");
      }
      const h: string[] = [];
      expect(checkLine(ex, h, `m=\\frac{${B.y}-${A.y}}{${B.x}-${A.x}}=${fmt(m)}`).status).toBe("ok");
      h.push(`m=${fmt(m)}`);
      expect(checkLine(ex, h, `y=${fmt(m)}x+b`).status).toBe("ok");
      expect(checkLine(ex, h, `${A.y}=${fmt(m)}\\cdot${A.x}+b`).status).toBe("ok");
      expect(checkLine(ex, h, `b=${fmt(b)}`).status).toBe("ok");
      h.push(`b=${fmt(b)}`);
      const wrong = checkLine(ex, h, `y=${fmt(m)}x+${fmt(b + 1)}`);
      expect(wrong.status).toBe("wrong");
      const done = checkLine(ex, h, `y=${fmt(m)}x${b >= 0 ? "+" : ""}${fmt(b)}`);
      expect(done.status).toBe("done");
    }
  });
  it("line_through L3: perpendicular traps", () => {
    let seen = 0;
    for (let s = 1; s < 60 && seen < 5; s++) {
      const ex = generate("line_through", 3, s);
      if (!/מאונך/.test(ex.instruction)) continue;
      seen++;
      const gm = ex.plot!.lines![0].m;
      const r = checkLine(ex, [], `m=${fmt(-gm)}`);
      expect(r.status).toBe("wrong");
      expect(r.mistake).toBe("perp");
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("geo – פרבולה", () => {
  it("features: vertex sign trap, roots as x-list then points", () => {
    for (let s = 1; s < 30; s++) {
      const ex = generate("parabola_features", 2, s);
      const [a, b, c] = [ex.params!.a, ex.params!.b, ex.params!.c];
      const V = ask(ex, "V");
      const P1 = ask(ex, "P1"),
        P2 = ask(ex, "P2");
      const h: string[] = [];
      expect(checkLine(ex, h, `(0,${c})`).status).toBe("ok");
      h.push(`(0,${c})`);
      // wall/floor mix
      if (c !== 0 && c !== P1.x && c !== P2.x) expect(checkLine(ex, h, `(${c},0)`).status).toBe("wrong");
      expect(checkLine(ex, h, `${a === 1 ? "" : a}x^{2}${b >= 0 ? "+" : ""}${b}x${c >= 0 ? "+" : ""}${c}=0`).status).toBe("ok");
      expect(checkLine(ex, h, `x=${P1.x},x=${P2.x}`).status).toBe("ok");
      expect(checkLine(ex, h, `(${P1.x},0),(${P2.x},0)`).status).toBe("ok");
      h.push(`(${P1.x},0),(${P2.x},0)`);
      if (V.x !== 0 && -V.x! !== P1.x && -V.x! !== P2.x) {
        const t = checkLine(ex, h, `x=${fmt(-V.x!)}`);
        expect(t.status).toBe("wrong");
        expect(t.mistake).toBe("vertex_sign");
      }
      expect(checkLine(ex, h, `x=\\frac{-${b}}{2\\cdot${a}}=${fmt(V.x!)}`).status).toBe("ok");
      const done = checkLine(ex, h, `(${fmt(V.x!)},${fmt(V.y!)})`);
      expect(done.status, `${ex.promptLatex} ${done.message}`).toBe("done");
    }
  });
  it("parabola_line: y of the point must come from the line", () => {
    for (let s = 1; s < 20; s++) {
      const ex = generate("parabola_line", 2, s);
      const P1 = ask(ex, "P1"),
        P2 = ask(ex, "P2");
      const h: string[] = [];
      expect(checkLine(ex, h, `x=${P1.x}`).status).toBe("ok");
      if (P1.y !== 0) expect(checkLine(ex, h, `(${P1.x},0)`).status).toBe("wrong");
      expect(checkLine(ex, h, `(${P1.x},${P1.y})`).status).toBe("ok");
      h.push(`(${P1.x},${P1.y})`);
      expect(checkLine(ex, h, `(${P2.x},${P2.y})`).status).toBe("done");
    }
  });
});

describe("geo – גאומטריה אנליטית", () => {
  it("distance: forgot sqrt / added legs; AB= alias; midpoint traps", () => {
    for (let s = 1; s < 30; s++) {
      const ex = generate("distance_mid", 2, s);
      const d = ex.params!.d;
      const M = ask(ex, "M");
      const [A, B] = ex.plot!.points!;
      const noSqrt = checkLine(ex, [], `d=${d * d}`);
      expect(noSqrt.status).toBe("wrong");
      expect(noSqrt.mistake).toBe("sqrt");
      expect(checkLine(ex, [], `d^2=${d * d}`).status).toBe("ok");
      expect(checkLine(ex, [], `d=\\sqrt{(${B.x}-${A.x})^2+(${B.y}-${A.y})^2}`).status).toBe("ok");
      const ab = checkLine(ex, [], `AB=${d}`);
      expect(ab.status).toBe("ok");
      expect(geoChecklist(ex, [`AB=${d}`])[0].done).toBe(true);
      const h = [`d=${d}`];
      const sub = checkLine(ex, h, `(${fmt((B.x - A.x) / 2)},${fmt((B.y - A.y) / 2)})`);
      if (!(M.x === (B.x - A.x) / 2 && M.y === (B.y - A.y) / 2)) expect(sub.status).toBe("wrong");
      expect(checkLine(ex, h, `M=(\\frac{${A.x}+${B.x}}{2},\\frac{${A.y}+${B.y}}{2})`).status).toBe("done");
    }
    expect(segKey("AB")).toBe("q1011");
  });
  it("slopes: perpendicular traps at L1, m1/m2 at L2", () => {
    for (let s = 1; s < 20; s++) {
      const ex = generate("slopes_perp", 1, s);
      const gm = ex.plot!.lines![0].m;
      const onlySign = checkLine(ex, [], `m=${fmt(-gm)}`);
      expect(onlySign.status).toBe("wrong");
      expect(onlySign.mistake).toBe("perp");
      expect(checkLine(ex, [], `m=${fmt(-1 / gm)}`).status).toBe("done");
      // bare number also accepted
      expect(checkLine(ex, [], fmt(-1 / gm)).status).toBe("done");
    }
    for (let s = 1; s < 20; s++) {
      const ex = generate("slopes_perp", 2, s);
      const m1 = ex.params!.m1,
        m2 = ex.params!.m2;
      expect(checkLine(ex, [], `m_1=${fmt(m1)}`).status).toBe("ok");
      expect(checkLine(ex, [`m_1=${fmt(m1)}`], `m_2=${fmt(m2)}`).status).toBe("done");
      expect(checkLine(ex, [`m_1=${fmt(m1)}`], `m_1\\cdot m_2=-1`).status).toBe("ok");
    }
  });
  it("area: forgot /2 trap, AB= AC= intermediate lines", () => {
    for (let s = 1; s < 20; s++) {
      const ex = generate("triangle_area", 1, s);
      const S = ex.params!.S,
        a = ex.params!.a,
        h = ex.params!.h;
      const t = checkLine(ex, [], `S=${a * h}`);
      expect(t.status).toBe("wrong");
      expect(t.mistake).toBe("area_half");
      expect(checkLine(ex, [], `AB=${a}`).status).toBe("ok");
      expect(checkLine(ex, [], `AC=${h}`).status).toBe("ok");
      expect(checkLine(ex, [`AB=${a}`], `S=\\frac{${a}\\cdot${h}}{2}=${fmt(S)}`).status).toBe("done");
      expect(checkLine(ex, [], `${fmt(S)}`).status).toBe("done");
    }
  });
});
