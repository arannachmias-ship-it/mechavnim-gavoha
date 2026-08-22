"use client";
import Link from "next/link";
import type { Plan } from "@/lib/plan";
import { typeTitle } from "@/lib/plan";
import { missionOf, examReadinessPercent } from "@/lib/mission";
import { examDateHe } from "@/components/PlanWidgets";

/**
 * 🎯 ה-Hero של מסך הבית: ספירה לאחור, מוכנות למבחן שרק עולה,
 * ומשימת יום עם קו סיום ורגע סגירה. כפתור אחד – ישר לתרגול.
 */

function Ring({ pct, done, children }: { pct: number; done: boolean; children: React.ReactNode }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[108px] h-[108px] shrink-0" aria-hidden>
      <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
        <circle cx="54" cy="54" r={R} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        <circle
          cx="54"
          cy="54"
          r={R}
          fill="none"
          stroke={done ? "var(--color-lime-deep)" : "url(#mh-grad)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
        <defs>
          <linearGradient id="mh-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" />
            <stop offset="1" stopColor="var(--color-primary-deep)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export default function MissionHero({ p }: { p: Plan }) {
  const m = missionOf(p);
  if (m.state === "disabled") return null;
  const readiness = examReadinessPercent(p);
  const done = m.state === "done";

  return (
    <section className={`card space-y-3 ${done ? "!bg-lime-tint/80 !border-lime-deep/50" : "!border-primary/30"}`}>
      {/* שורת המבחן */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight">
            {m.state === "exam_passed" ? "המבחן מאחורייך 💛" : p.daysLeft === 1 ? "המבחן מחר" : `עוד ${p.daysLeft} ימים למבחן`}
          </div>
          <div className="text-xs text-muted">
            {p.settings.examTitle} · {examDateHe(p.examDate)}
          </div>
        </div>
        <Link href="/plan" className="btn-ghost text-xs shrink-0">
          התוכנית המלאה ←
        </Link>
      </div>

      {m.state !== "exam_passed" && (
        <div className="flex items-center gap-4">
          <Ring pct={m.state === "off" || m.state === "empty" ? 0 : m.pct} done={done}>
            {done ? (
              <span className="text-4xl leading-none animate-pop" aria-hidden>
                ✓
              </span>
            ) : m.state === "off" || m.state === "empty" ? (
              <span className="text-2xl" aria-hidden>
                🌿
              </span>
            ) : (
              <>
                <div className="text-2xl font-black leading-none">
                  {m.doneEx}
                  <span className="text-muted text-base font-bold">/{m.targetEx}</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">תרגילים היום</div>
              </>
            )}
          </Ring>

          <div className="flex-1 min-w-0 space-y-2">
            {done ? (
              <div className="animate-pop">
                <div className="font-black text-lg text-lime-ink">סגרת את היום! ✨</div>
                <div className="text-sm text-ink-soft">
                  {m.targetEx} תרגילים. מעכשיו – הכול בונוס, ומחר ממשיכות מנקודה גבוהה יותר.
                </div>
              </div>
            ) : m.state === "off" ? (
              <div className="text-sm text-ink-soft">היום יום מנוחה בתוכנית. אם בא לך בכל זאת – כל תרגיל נספר 🙂</div>
            ) : m.state === "empty" ? (
              <div className="text-sm text-ink-soft">אין משימות להיום – אפשר לנוח, או לחזק כל נושא מהמפה.</div>
            ) : (
              <>
                <div className="text-sm">
                  <span className="font-bold">המשימה של היום:</span>{" "}
                  <span className="text-ink-soft">
                    נשארו {m.remainEx} תרגילים · בערך {m.remainMinutes} דק׳
                  </span>
                </div>
              </>
            )}

            {/* מוכנות למבחן – המספר שרק עולה */}
            <div>
              <div className="flex justify-between text-xs text-ink-soft mb-1">
                <span>מוכנות למבחן</span>
                <span className="font-black text-primary-ink">{readiness}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-line overflow-hidden" dir="rtl">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${readiness}%`, background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" }}
                />
              </div>
              <div className="text-[11px] text-muted mt-1">
                <b className="text-lime-ink">{p.readyTypes}</b>/{p.totalTypes} סוגי תרגילים כבר מוכנים למבחן
              </div>
            </div>
          </div>
        </div>
      )}

      {m.state === "open" && m.firstOpenTypeId && (
        <Link href={`/practice/${m.firstOpenTypeId}`} className="btn-primary block text-center text-lg py-3">
          {m.doneEx > 0 ? "להמשיך" : "להתחיל"} – {typeTitle(m.firstOpenTypeId)} ←
        </Link>
      )}
    </section>
  );
}

/** 💬 הפתק של אבא – בולט, בקול שלו. מגיע מהגדרות התוכנית במסך ההורה. */
export function DadNote({ note }: { note: string }) {
  if (!note.trim()) return null;
  return (
    <section className="card flex items-start gap-3 !border-warn/40" style={{ background: "linear-gradient(135deg, rgb(255 249 235 / .95), rgb(255 255 255 / .85))" }}>
      <span className="w-10 h-10 rounded-2xl bg-topic-green text-topic-green-ink flex items-center justify-center text-lg font-black shrink-0" aria-hidden>
        א
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted font-semibold mb-0.5">מאבא</div>
        <div className="leading-relaxed font-medium">{note}</div>
      </div>
    </section>
  );
}
