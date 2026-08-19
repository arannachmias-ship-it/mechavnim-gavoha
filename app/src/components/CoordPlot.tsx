"use client";
import type { PlotSpec } from "@/lib/math/types";

/**
 * מערכת צירים קטנה ב-SVG: מציירת רק את הנתונים של התרגיל (ישר, פרבולה, נקודות, קטעים, מצולע).
 * "האפליקציה תראה את הציור לפני הנוסחה" – ארן.
 */
export default function CoordPlot({ spec, size = 260, className = "" }: { spec: PlotSpec; size?: number; className?: string }) {
  // ---- bounds ----
  const xs: number[] = [0],
    ys: number[] = [0];
  for (const p of spec.points ?? []) {
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const s of spec.segments ?? []) {
    xs.push(s.a[0], s.b[0]);
    ys.push(s.a[1], s.b[1]);
  }
  for (const p of spec.polygon ?? []) {
    xs.push(p[0]);
    ys.push(p[1]);
  }
  for (const l of spec.lines ?? []) {
    ys.push(l.b);
    if (l.m !== 0) xs.push(-l.b / l.m);
  }
  for (const q of spec.parabolas ?? []) {
    const xv = -q.b / (2 * q.a),
      yv = q.a * xv * xv + q.b * xv + q.c;
    xs.push(xv);
    ys.push(yv, q.c);
    const disc = q.b * q.b - 4 * q.a * q.c;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      xs.push((-q.b - r) / (2 * q.a), (-q.b + r) / (2 * q.a));
    }
  }
  let xmin = Math.min(...xs) - 1.5,
    xmax = Math.max(...xs) + 1.5,
    ymin = Math.min(...ys) - 1.5,
    ymax = Math.max(...ys) + 1.5;
  xmin = Math.min(xmin, -3);
  xmax = Math.max(xmax, 3);
  ymin = Math.min(ymin, -3);
  ymax = Math.max(ymax, 3);
  // square-ish
  const span = Math.max(xmax - xmin, ymax - ymin);
  const cx = (xmin + xmax) / 2,
    cy = (ymin + ymax) / 2;
  xmin = cx - span / 2;
  xmax = cx + span / 2;
  ymin = cy - span / 2;
  ymax = cy + span / 2;
  const W = size,
    H = size;
  const sx = (x: number) => ((x - xmin) / (xmax - xmin)) * W;
  const sy = (y: number) => H - ((y - ymin) / (ymax - ymin)) * H;
  const step = span > 24 ? 5 : span > 12 ? 2 : 1;
  const grid: number[] = [];
  for (let v = Math.ceil(xmin / step) * step; v <= xmax; v += step) grid.push(v);
  const gridY: number[] = [];
  for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) gridY.push(v);
  const showX0 = xmin < 0 && xmax > 0,
    showY0 = ymin < 0 && ymax > 0;

  const parabolaPath = (q: { a: number; b: number; c: number }) => {
    const pts: string[] = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const x = xmin + ((xmax - xmin) * i) / n;
      const y = q.a * x * x + q.b * x + q.c;
      if (y < ymin - span || y > ymax + span) continue;
      pts.push(`${sx(x).toFixed(1)},${sy(y).toFixed(1)}`);
    }
    return pts.length ? "M" + pts.join(" L") : "";
  };
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} direction="ltr" className={`bg-white rounded-xl border border-slate-200 mx-auto max-w-full ${className}`} role="img" aria-label="ציור במערכת צירים">
      {/* grid */}
      {grid.map((v) => (
        <line key={"gx" + v} x1={sx(v)} x2={sx(v)} y1={0} y2={H} stroke="#eef2f7" strokeWidth={1} />
      ))}
      {gridY.map((v) => (
        <line key={"gy" + v} y1={sy(v)} y2={sy(v)} x1={0} x2={W} stroke="#eef2f7" strokeWidth={1} />
      ))}
      {/* axes */}
      {showY0 && <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="#64748b" strokeWidth={1.4} />}
      {showX0 && <line y1={0} y2={H} x1={sx(0)} x2={sx(0)} stroke="#64748b" strokeWidth={1.4} />}
      {showY0 && (
        <text x={W - 10} y={sy(0) - 4} fontSize={11} fill="#64748b">
          x
        </text>
      )}
      {showX0 && (
        <text x={sx(0) + 5} y={11} fontSize={11} fill="#64748b">
          y
        </text>
      )}
      {/* tick labels */}
      {showY0 &&
        grid
          .filter((v) => v !== 0)
          .map((v) => (
            <text key={"tx" + v} x={sx(v)} y={sy(0) + 11} fontSize={8.5} textAnchor="middle" fill="#94a3b8">
              {fmt(v)}
            </text>
          ))}
      {showX0 &&
        gridY
          .filter((v) => v !== 0)
          .map((v) => (
            <text key={"ty" + v} x={sx(0) - 4} y={sy(v) + 3} fontSize={8.5} textAnchor="end" fill="#94a3b8">
              {fmt(v)}
            </text>
          ))}
      {/* polygon */}
      {spec.polygon && spec.polygon.length > 2 && <polygon points={spec.polygon.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")} fill="#fde68a" fillOpacity={0.55} stroke="#d97706" strokeWidth={1.8} />}
      {/* lines */}
      {(spec.lines ?? []).map((l, i) => (
        <line key={"l" + i} x1={sx(xmin)} y1={sy(l.m * xmin + l.b)} x2={sx(xmax)} y2={sy(l.m * xmax + l.b)} stroke="#0ea5e9" strokeWidth={2.2} />
      ))}
      {/* parabolas */}
      {(spec.parabolas ?? []).map((q, i) => (
        <path key={"p" + i} d={parabolaPath(q)} fill="none" stroke="#d946ef" strokeWidth={2.2} />
      ))}
      {/* segments */}
      {(spec.segments ?? []).map((s, i) => (
        <g key={"s" + i}>
          <line x1={sx(s.a[0])} y1={sy(s.a[1])} x2={sx(s.b[0])} y2={sy(s.b[1])} stroke={s.dashed ? "#94a3b8" : "#f59e0b"} strokeWidth={s.dashed ? 1.5 : 2.4} strokeDasharray={s.dashed ? "4 4" : undefined} />
          {s.label && (
            <text x={(sx(s.a[0]) + sx(s.b[0])) / 2 + 4} y={(sy(s.a[1]) + sy(s.b[1])) / 2 - 4} fontSize={10} fill="#64748b">
              {s.label}
            </text>
          )}
        </g>
      ))}
      {/* points */}
      {(spec.points ?? []).map((p, i) => (
        <g key={"pt" + i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={4.2} fill="#dc2626" stroke="white" strokeWidth={1.5} />
          {p.label && (
            <text x={sx(p.x) + 6} y={sy(p.y) - 6} fontSize={11} fontWeight={700} fill="#b91c1c">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
