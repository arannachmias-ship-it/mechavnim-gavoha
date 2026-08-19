"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { evalCalc } from "@/lib/calc";

/**
 * 🧮 מחשבון מדעי-פשוט – נפתח כגיליון מעל התרגול, כדי שנגה לא תצא למחשבון של הטלפון (ותאבד את המקום).
 * מותר בבגרות 4 יח"ל: ארבע פעולות, סוגריים, חזקה, שורש. בלי טריגו – עוד לא.
 */
export default function Calculator({ onUse, onInsert, compact = false }: { onUse?: () => void; onInsert?: (text: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<{ text: string; frac?: string } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ expr: string; text: string }[]>([]);
  const justEvaluated = useRef(false);

  const press = (k: string) => {
    setError("");
    if (justEvaluated.current) {
      // אחרי "=" – מספר חדש מתחיל ביטוי חדש, פעולה ממשיכה מהתוצאה
      justEvaluated.current = false;
      if (/^[+−×÷^²]$/.test(k) && result) setExpr(result.text + k);
      else setExpr(k);
      setResult(null);
      return;
    }
    setExpr((e) => e + k);
  };
  const clear = () => {
    setExpr("");
    setResult(null);
    setError("");
    justEvaluated.current = false;
  };
  const back = () => {
    setError("");
    if (justEvaluated.current) return clear();
    setExpr((e) => e.slice(0, -1));
  };
  const negate = () => {
    setError("");
    if (justEvaluated.current && result) {
      const v = result.text.startsWith("-") ? result.text.slice(1) : "-" + result.text;
      setExpr(v);
      setResult(null);
      justEvaluated.current = false;
      return;
    }
    setExpr((e) => (e.startsWith("-") ? e.slice(1) : "-" + e));
  };
  const equals = () => {
    if (!expr.trim()) return;
    const r = evalCalc(expr);
    if (!r.ok) {
      setError(r.error || "משהו לא הסתדר");
      return;
    }
    setResult({ text: r.text!, frac: r.frac });
    setHistory((h) => [{ expr, text: r.text! }, ...h].slice(0, 4));
    justEvaluated.current = true;
    onUse?.();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        return equals();
      }
      if (e.key === "Backspace") return back();
      const map: Record<string, string> = { "*": "×", "/": "÷", "-": "−", "+": "+", "^": "^", "(": "(", ")": ")", ".": "." };
      if (/^[0-9]$/.test(e.key)) return press(e.key);
      if (map[e.key]) {
        e.preventDefault();
        return press(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expr, result]);

  const Key = ({ label, onClick, cls = "", title }: { label: string; onClick: () => void; cls?: string; title?: string }) => (
    <button type="button" onClick={onClick} title={title} className={`h-12 rounded-xl text-xl font-semibold active:scale-95 transition select-none ${cls || "bg-slate-100 hover:bg-slate-200 text-slate-800"}`}>
      {label}
    </button>
  );
  const op = "bg-amber-100 hover:bg-amber-200 text-amber-900";

  return (
    <>
      <button className={compact ? "btn-ghost text-sm px-2" : "btn-soft text-sm"} onClick={() => setOpen(true)} title="מחשבון">
        🧮 מחשבון
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
            <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="מחשבון">
              <div className="flex items-center gap-2 p-3 border-b">
                <div className="font-bold flex-1">🧮 מחשבון</div>
                <div className="text-xs text-slate-500">מותר בבגרות – בלי טריגו (עוד לא)</div>
                <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="סגור">✕</button>
              </div>
              <div className="p-3 space-y-2">
                {history.length > 0 && (
                  <div className="text-xs text-slate-400 space-y-0.5 max-h-16 overflow-y-auto" dir="ltr">
                    {history.slice(0, 3).map((h, i) => (
                      <button key={i} type="button" className="block w-full text-left hover:text-slate-600 truncate" onClick={() => { setExpr(h.text); setResult(null); justEvaluated.current = false; }} title="להמשיך מהתוצאה">
                        {h.expr} = {h.text}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 min-h-[64px] flex flex-col justify-center" dir="ltr">
                  <div className={`text-lg break-all ${result ? "text-slate-500" : "text-slate-900"}`}>{expr || <span className="text-slate-300">0</span>}</div>
                  {result && (
                    <div className="text-2xl font-black text-slate-900 flex items-baseline gap-2">
                      = {result.text}
                      {result.frac && <span className="text-sm text-slate-500 font-normal">({result.frac})</span>}
                    </div>
                  )}
                  {error && <div className="text-sm text-red-600" dir="rtl">{error}</div>}
                </div>
                <div className="grid grid-cols-5 gap-2" dir="ltr">
                  <Key label="C" onClick={clear} cls="bg-red-50 hover:bg-red-100 text-red-700" title="נקה" />
                  <Key label="⌫" onClick={back} cls="bg-slate-200 hover:bg-slate-300 text-slate-800" title="מחק" />
                  <Key label="(" onClick={() => press("(")} cls={op} />
                  <Key label=")" onClick={() => press(")")} cls={op} />
                  <Key label="÷" onClick={() => press("÷")} cls={op} />
                  <Key label="7" onClick={() => press("7")} />
                  <Key label="8" onClick={() => press("8")} />
                  <Key label="9" onClick={() => press("9")} />
                  <Key label="×" onClick={() => press("×")} cls={op} />
                  <Key label="√" onClick={() => press("√(")} cls={op} title="שורש" />
                  <Key label="4" onClick={() => press("4")} />
                  <Key label="5" onClick={() => press("5")} />
                  <Key label="6" onClick={() => press("6")} />
                  <Key label="−" onClick={() => press("−")} cls={op} />
                  <Key label="x²" onClick={() => press("²")} cls={op} title="בריבוע" />
                  <Key label="1" onClick={() => press("1")} />
                  <Key label="2" onClick={() => press("2")} />
                  <Key label="3" onClick={() => press("3")} />
                  <Key label="+" onClick={() => press("+")} cls={op} />
                  <Key label="xʸ" onClick={() => press("^")} cls={op} title="חזקה" />
                  <Key label="±" onClick={negate} title="הפוך סימן" />
                  <Key label="0" onClick={() => press("0")} />
                  <Key label="." onClick={() => press(".")} />
                  <Key label="=" onClick={equals} cls="col-span-2 bg-amber-500 hover:bg-amber-600 text-white" />
                </div>
                {onInsert && result && (
                  <button
                    type="button"
                    className="btn-soft w-full text-sm"
                    onClick={() => {
                      onInsert(result.text);
                      setOpen(false);
                    }}
                  >
                    ⤴ להכניס {result.text} לשורה
                  </button>
                )}
                <div className="text-[11px] text-slate-400">המחשבון לחישוב – השיטה והשלבים עדיין שלך. הוא לא פותר משוואות ולא מכיר x.</div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
