"use client";
import Link from "next/link";
import type { Plan, PlanTask } from "@/lib/plan";
import { KIND_LABEL, topicOf, typeTitle } from "@/lib/plan";
import Monogram from "@/components/Monogram";

/** 🎯 רכיבי התוכנית – משותפים למסך הראשי, למסך התוכנית ולמסך ההורה */

export function examDateHe(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}.${m}`;
}

export function countdownText(p: Plan) {
  if (p.status === "exam_passed") return "המבחן מאחורייך 💛";
  if (p.daysLeft === 1) return "המבחן מחר";
  return `עוד ${p.daysLeft} ימים למבחן`;
}

/** שורת משימה אחת: נושא · סוג · יעד · מצב */
export function TaskRow({ t, linky = true, compact = false }: { t: PlanTask; linky?: boolean; compact?: boolean }) {
  const topic = topicOf(t.topicId);
  const done = t.done >= t.exercises;
  const partial = !done && t.done > 0;
  const inner = (
    <>
      {done ? (
        <span className="w-[34px] h-[34px] rounded-xl bg-lime text-lime-ink flex items-center justify-center font-black shrink-0">✓</span>
      ) : (
        <Monogram topicId={t.topicId} />
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold leading-tight truncate ${done ? "text-lime-ink" : ""}`}>
          {typeTitle(t.typeId)}
          <span className="text-muted font-normal text-xs mr-1">· {topic?.title.split(" – ")[0]}</span>
        </div>
        <div className="text-xs text-muted">
          {KIND_LABEL[t.kind]} · {t.exercises} תרגילים · ~{t.minutes} דק׳
          {partial && <span className="text-primary-ink font-semibold"> · {t.done}/{t.exercises} ✓</span>}
        </div>
      </div>
      {linky && !done && <span className="btn-soft text-xs px-3 py-1.5 shrink-0">{partial ? "להמשיך" : "להתחיל"}</span>}
    </>
  );
  const cls = `flex items-center gap-3 rounded-2xl px-3 py-2 border ${done ? "bg-lime-tint border-lime-deep/40" : partial ? "bg-primary-tint/60 border-primary/25" : "bg-white/85 border-white"} ${linky && !done ? "hover:border-primary/40 transition" : ""}`;
  if (linky && !done)
    return (
      <Link href={`/practice/${t.typeId}`} className={cls}>
        {inner}
      </Link>
    );
  return <div className={cls}>{inner}</div>;
}

/** פס מוכנות: כמה סוגי תרגילים "מוכנים" מתוך הכול */
export function ReadinessBar({ p }: { p: Plan }) {
  const pct = p.totalTypes ? Math.round((p.readyTypes / p.totalTypes) * 100) : 0;
  const almost = p.needs.filter((n) => n.readiness === "almost").length;
  const apct = p.totalTypes ? Math.round((almost / p.totalTypes) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-soft mb-1">
        <span>מוכנות למבחן</span>
        <span>
          <b className="text-lime-ink">{p.readyTypes}</b>/{p.totalTypes} סוגי תרגילים מוכנים{almost ? ` · ${almost} כמעט` : ""}
        </span>
      </div>
      <div className="h-3 rounded-full bg-line overflow-hidden flex" dir="rtl">
        <div className="h-full bg-lime-deep transition-all" style={{ width: `${pct}%` }} />
        <div className="h-full bg-primary/40 transition-all" style={{ width: `${apct}%` }} />
      </div>
    </div>
  );
}

/** הכרטיס הקומפקטי במסך הראשי של נגה */
export function PlanHomeCard({ p }: { p: Plan }) {
  if (p.status === "disabled") return null;
  const open = p.todayTasks.filter((t) => t.done < t.exercises);
  const todayOff = p.days[0]?.off;
  const total = p.todayTasks.reduce((s, t) => s + t.exercises, 0);
  const doneEx = p.todayTasks.reduce((s, t) => s + Math.min(t.done, t.exercises), 0);
  return (
    <section className={`card space-y-2 ${p.status === "done" ? "!bg-lime-tint/80 !border-lime-deep/50" : "!border-primary/30"}`}>
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" }} aria-hidden>
          {p.status === "exam_passed" ? "✓" : p.daysLeft}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight">הדרך ל-{examDateHe(p.examDate)}</div>
          <div className="text-xs text-ink-soft">{countdownText(p)}{p.status !== "exam_passed" && total ? ` · היום: ${doneEx}/${total} תרגילים` : ""}</div>
        </div>
        <Link href="/plan" className="btn-ghost text-xs">
          התוכנית המלאה ←
        </Link>
      </div>
      {p.status === "exam_passed" ? null : todayOff ? (
        <div className="text-sm text-ink-soft">היום יום חופש בתוכנית. אם בא לך בכל זאת – כל תרגיל נספר 🙂</div>
      ) : p.status === "done" ? (
        <div className="text-sm text-lime-ink font-semibold">סיימת את מה שתוכנן להיום ✓ כל דבר מעבר זה בונוס.</div>
      ) : (
        <div className="space-y-1.5">
          {open.slice(0, 3).map((t) => (
            <TaskRow key={t.typeId} t={t} compact />
          ))}
          {open.length > 3 && <div className="text-xs text-muted">ועוד {open.length - 3}…</div>}
        </div>
      )}
      {p.settings.note && <div className="text-xs text-ink-soft border-t border-line pt-2">💬 אבא: {p.settings.note}</div>}
    </section>
  );
}
