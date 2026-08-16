"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FORMULAS } from "@/content/formulas";
import { Math as M, Txt } from "@/components/MathText";

/** כפתור "נוסחאון" + חלון צף. הנוסחאון לפי דף הנוסחאות הרשמי ל-4 יח"ל. */
export default function FormulaSheet({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const sections = FORMULAS.filter((s) => showAll || s.now);
  return (
    <>
      <button className={compact ? "btn-ghost text-sm px-2" : "btn-soft text-sm"} onClick={() => setOpen(true)} title="נוסחאון 4 יח״ל">
        📄 נוסחאון
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-3 border-b">
              <div className="font-bold flex-1">📄 נוסחאון – 4 יח״ל</div>
              <label className="text-xs text-slate-500 flex items-center gap-1">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> הכול (גם מה שעוד לא למדנו)
              </label>
              <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="סגור">✕</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-4">
              <div className="text-xs text-slate-500">לפי דף הנוסחאות הרשמי של משרד החינוך לבגרות ב-4 יח״ל. הנוסחאות האלה יהיו איתך גם בבחינה – לא צריך לזכור בעל פה, צריך לדעת להשתמש.</div>
              {sections.map((s) => (
                <section key={s.id}>
                  <h3 className="font-bold text-amber-800 mb-1">{s.title}</h3>
                  <div className="space-y-2">
                    {s.items.map((it, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <div className="text-lg overflow-x-auto" dir="ltr"><M latex={it.latex} /></div>
                        {it.note && <div className="text-xs text-slate-500 sm:mr-auto"><Txt s={it.note} /></div>}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
