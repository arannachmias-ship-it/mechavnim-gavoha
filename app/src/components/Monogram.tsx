/**
 * מדבקת נושא — מונוגרמה מתמטית במקום אמוג'י (אאורה).
 * תמיד LTR, צבע ה-ink של הגוון על רקע ה-tint.
 */
const TINTS = {
  violet: { bg: "var(--color-topic-violet)", ink: "var(--color-topic-violet-ink)" },
  green: { bg: "var(--color-topic-green)", ink: "var(--color-topic-green-ink)" },
  pink: { bg: "var(--color-topic-pink)", ink: "var(--color-topic-pink-ink)" },
  blue: { bg: "var(--color-topic-blue)", ink: "var(--color-topic-blue-ink)" },
  sand: { bg: "var(--color-topic-sand)", ink: "var(--color-topic-sand-ink)" },
} as const;
type Tint = keyof typeof TINTS;

interface Mono {
  tint: Tint;
  text?: string;
  /** גודל גופן יחסי (ברירת מחדל 12px על 34px) */
  fs?: number;
  /** Rubik רגיל במקום Georgia איטלקי */
  upright?: boolean;
  svg?: "slope" | "parabola-line";
}

const MONOGRAMS: Record<string, Mono> = {
  order_ops: { tint: "violet", text: "×÷", upright: true },
  families: { tint: "green", text: "x+x" },
  parens: { tint: "pink", text: "( )" },
  common_factor: { tint: "violet", text: "a( )" },
  short_mult: { tint: "sand", text: "(a+b)²", fs: 10 },
  linear_eq: { tint: "green", text: "=", fs: 16 },
  linear_eq_frac: { tint: "blue", text: "x⁄2" },
  factoring: { tint: "pink", text: "( )( )", fs: 10 },
  domain: { tint: "sand", text: "≠0" },
  quadratic_eq: { tint: "violet", text: "x²" },
  systems: { tint: "green", text: "{", fs: 16 },
  linear_func: { tint: "blue", svg: "slope" },
  parabola: { tint: "pink", text: "∪", fs: 16, upright: true },
  parabola_line: { tint: "violet", svg: "parabola-line" },
  analytic: { tint: "sand", text: "△", fs: 14, upright: true },
};

function SlopeSvg({ ink }: { ink: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <line x1="2" y1="15" x2="16" y2="3" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="9" r="2.4" fill={ink} />
    </svg>
  );
}

function ParabolaLineSvg({ ink }: { ink: string }) {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden>
      <path d="M3 3 Q10 22 17 3" stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="2" y1="9" x2="18" y2="7" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Monogram({ topicId, size = 34, className = "" }: { topicId: string; size?: number; className?: string }) {
  const m = MONOGRAMS[topicId] ?? { tint: "violet" as Tint, text: "∑" };
  const t = TINTS[m.tint];
  const scale = size / 34;
  return (
    <span
      className={`monogram ${className}`}
      dir="ltr"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(12 * scale),
        background: t.bg,
        color: t.ink,
        fontSize: Math.round((m.fs ?? 12) * scale),
        ...(m.upright ? { fontFamily: "var(--font-sans)", fontStyle: "normal" } : {}),
      }}
    >
      {m.svg === "slope" ? <SlopeSvg ink={t.ink} /> : m.svg === "parabola-line" ? <ParabolaLineSvg ink={t.ink} /> : m.text}
    </span>
  );
}
