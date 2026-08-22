"use client";
import { useState } from "react";
import type { Plan } from "@/lib/plan";
import { typeTitle } from "@/lib/plan";
import type { Summary } from "@/lib/progress";
import { missionOf, nudgeText } from "@/lib/mission";

/**
 * 👨‍👧 הפולס של אבא: האם נגה נכנסה היום, ומה עושים עם זה.
 * הדחיפה לא עוברת דרך התראות של אפליקציה – היא עוברת דרך אבא בוואטסאפ,
 * עם הודעה מוכנה בקול הנכון (אפשר לערוך לפני שליחה).
 */
export default function ParentPulse({ plan, summary }: { plan: Plan | null; summary: Summary }) {
  const [copied, setCopied] = useState(false);
  if (!plan || plan.status === "disabled" || plan.status === "exam_passed") return null;
  const m = missionOf(plan);
  const msg = nudgeText(plan, typeTitle);

  const lastAttempt = summary.recent[0]?.created_at ?? null;
  const lastText = lastAttempt
    ? new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(lastAttempt))
    : null;

  const entered = m.doneEx > 0 || plan.todayDoneCount > 0;
  const closed = m.state === "done";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className={`rounded-2xl border p-3 space-y-2 ${closed ? "border-emerald-200 bg-emerald-50" : entered ? "border-sky-200 bg-sky-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {closed ? "🏁" : entered ? "🏃‍♀️" : "😴"}
        </span>
        <div className="flex-1 min-w-0 text-sm">
          {closed ? (
            <b className="text-emerald-900">נגה סגרה את היום – {m.doneEx} תרגילים ✓</b>
          ) : entered ? (
            <b className="text-sky-900">
              נגה באמצע: {m.doneEx}/{m.targetEx} תרגילים היום · נשארו ~{m.remainMinutes} דק׳
            </b>
          ) : (
            <b className="text-amber-900">נגה עוד לא נכנסה היום ({plan.daysLeft === 1 ? "המבחן מחר" : `עוד ${plan.daysLeft} ימים למבחן`})</b>
          )}
          {lastText && <div className="text-xs text-slate-500">פעילות אחרונה: {lastText}</div>}
        </div>
      </div>

      <div className="rounded-xl bg-white/80 border border-black/5 p-2 text-sm text-slate-700">💬 {msg}</div>

      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 text-center text-sm"
        >
          לשלוח לה בוואטסאפ ←
        </a>
        <button className="btn-soft text-sm" onClick={copy}>
          {copied ? "הועתק ✓" : "העתקה"}
        </button>
      </div>
      <div className="text-[11px] text-slate-400">
        ההודעה מנוסחת לפי מצב היום – אפשר (וכדאי) לערוך לפני שליחה. מילה ממך שווה יותר מכל התראה. את הפתק הקבוע שנגה רואה במסך שלה
        עורכים בהגדרות התוכנית למטה (״משפט ממך״).
      </div>
    </section>
  );
}
