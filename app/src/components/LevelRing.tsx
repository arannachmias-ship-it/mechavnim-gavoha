/**
 * טבעת הרצף הנקי (אאורה): מחליפה את ●○○ הטקסטואלי.
 * הטבעת מתמלאת לפי כמה תרגילים נקיים ברצף (0–3); במילוי מלא עולים רמה.
 */
export default function LevelRing({ cleanRun, size = 20 }: { cleanRun: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(3, cleanRun)) / 3;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={`${cleanRun} מתוך 3 נקיים ברצף`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-lime-deep)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        style={{ transition: "stroke-dasharray .3s var(--ease-pop)" }}
      />
    </svg>
  );
}
