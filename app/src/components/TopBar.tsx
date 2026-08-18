"use client";
import Link from "next/link";
import type { Summary } from "@/lib/progress";
import FormulaSheet from "@/components/FormulaSheet";

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
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-amber-100">
      {tester && <div className="bg-violet-600 text-white text-center text-xs py-1">🧪 מצב בדיקה (אבא) – שום דבר לא נרשם לנגה</div>}
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3">
        {back ? (
          <Link href={back} className="btn-ghost px-2 text-xl" aria-label="חזרה">
            →
          </Link>
        ) : (
          <span className="text-2xl">🚀</span>
        )}
        <div className="flex-1 font-bold truncate">{title ?? "מכוונים גבוה"}</div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-ghost px-2 text-xl disabled:opacity-50"
            aria-label="רענון"
            title="רענון נתונים"
          >
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span>
          </button>
        )}
        {formulas && <FormulaSheet compact />}
        {summary && (
          <div className="flex items-center gap-2 text-sm">
            <span className="chip bg-amber-100 text-amber-800" title="נקודות">
              ⭐ {summary.xp}
            </span>
            <span className="chip bg-orange-100 text-orange-800" title="רצף ימים">
              🔥 {summary.streak}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
