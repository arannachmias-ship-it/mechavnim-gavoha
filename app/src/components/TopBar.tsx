"use client";
import Link from "next/link";
import type { Summary } from "@/lib/progress";
import FormulaSheet from "@/components/FormulaSheet";

/** הלוגו הקטן: העקומה העולה עם נקודת הליים – גרסת ה-SVG של הלוגו החדש */
function Logo() {
  return (
    <span
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" }}
      aria-hidden
    >
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
        <path d="M3.4 15 C4.6 10.6 6.1 8.4 7.1 9.2 C8 9.9 8.1 11.3 9.2 10.4 C10.3 9.5 11.6 7.1 13.1 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="13.6" cy="4.4" r="1.5" fill="#D6FF4B" />
      </svg>
    </span>
  );
}

export default function TopBar({
  summary,
  back,
  title,
  formulas = false,
  tester = false,
  onRefresh,
  refreshing = false,
}: {
  summary: Summary | null;
  back?: string;
  title?: string;
  formulas?: boolean;
  tester?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line" style={{ background: "rgb(243 243 252 / 0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      {tester && <div className="text-white text-center text-xs py-1" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" }}>🧪 מצב בדיקה (אבא) – שום דבר לא נרשם לנגה</div>}
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3">
        {back ? (
          <Link href={back} className="btn-ghost px-2 text-xl" aria-label="חזרה">
            →
          </Link>
        ) : (
          <Logo />
        )}
        <div className="flex-1 font-extrabold truncate text-[19px]">{title ?? "מכוונים גבוה"}</div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-ghost px-2 text-xl disabled:opacity-50"
            aria-label="רענון"
            title="רענון נתונים"
          >
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>↻</span>
          </button>
        )}
        {formulas && <FormulaSheet compact />}
        {summary && (
          <div className="flex items-center gap-2 text-sm">
            <span className="chip" title="נקודות">
              ⭐ {summary.xp}
            </span>
            <span className="chip" title="רצף ימים">
              🔥 {summary.streak}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
