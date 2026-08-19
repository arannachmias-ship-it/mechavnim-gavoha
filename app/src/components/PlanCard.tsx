"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Plan, PlanSettings } from "@/lib/plan";
import { READINESS_LABEL, dayLabel, topicOf, typeTitle } from "@/lib/plan";
import { TOPICS } from "@/content/topics";
import { ReadinessBar, TaskRow, countdownText, examDateHe } from "@/components/PlanWidgets";

/**
 * 🎯 מסך הורה: תוכנית העבודה עד המבחן – הגדרות (תאריך, דקות, ימי חופש, הודעה),
 * מצב מוכנות, היום והימים הבאים, ומעקב 7 ימים אחורה (יעד מול בפועל).
 */
export default function PlanCard() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [newOff, setNewOff] = useState("");

  const load = async () => {
    const r = await fetch("/api/plan", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (j.ok) {
      setPlan(j.plan);
      setForm(j.plan.settings);
    }
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const save = async (patch: Partial<PlanSettings>) => {
    if (!form) return;
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...patch }) });
    setSaving(false);
    if (r.ok) {
      const j = await r.json();
      setPlan(j.plan);
      setForm(j.plan.settings);
      setMsg("נשמר ✔");
      setTimeout(() => setMsg(""), 1500);
    } else setMsg("לא נשמר – נסה שוב");
  };

  if (!plan || !form) return <section className="card text-slate-500 text-sm">🎯 טוען תוכנית…</section>;
  const p = plan;
  const hours = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} שע׳` : `${m} דק׳`);
  const today = p.days[0];

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-bold flex-1 min-w-[10rem]">🎯 תוכנית עד המבחן ({examDateHe(p.examDate)})</h2>
        <span className={`chip text-xs ${p.settings.enabled ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"}`}>{p.settings.enabled ? countdownText(p) : "כבויה"}</span>
        <button className="btn-ghost text-xs" onClick={() => setEditing((v) => !v)}>
          {editing ? "סגור הגדרות" : "⚙️ הגדרות"}
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-xs text-slate-600">שם המבחן</div>
              <input className="w-full rounded-lg border p-2" value={form.examTitle} onChange={(e) => setForm({ ...form, examTitle: e.target.value })} />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-slate-600">תאריך המבחן</div>
              <input type="date" className="w-full rounded-lg border p-2" dir="ltr" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-slate-600">דקות ביום רגיל (א׳–ה׳)</div>
              <input type="number" min={0} max={240} className="w-full rounded-lg border p-2" dir="ltr" value={form.minutesPerDay} onChange={(e) => setForm({ ...form, minutesPerDay: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-slate-600">דקות בשישי/שבת</div>
              <input type="number" min={0} max={300} className="w-full rounded-lg border p-2" dir="ltr" value={form.weekendMinutes} onChange={(e) => setForm({ ...form, weekendMinutes: Number(e.target.value) })} />
            </label>
          </div>
          <label className="block space-y-1">
            <div className="text-xs text-slate-600">משפט ממך שיופיע לנגה מעל התוכנית (אופציונלי)</div>
            <input className="w-full rounded-lg border p-2" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="למשל: גאה בך. יום-יום קצת, זה כל הסוד." />
          </label>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">ימי חופש (לא מתוכנן כלום)</div>
            <div className="flex flex-wrap gap-2 items-center">
              {form.offDays.map((d) => (
                <span key={d} className="chip bg-white border text-xs">
                  {dayLabel(d, p.today)} <span className="text-slate-400">({d.slice(5)})</span>
                  <button className="text-red-600 mr-1" onClick={() => setForm({ ...form, offDays: form.offDays.filter((x) => x !== d) })} aria-label="הסר">
                    ✕
                  </button>
                </span>
              ))}
              <input type="date" className="rounded-lg border p-1.5 text-xs" dir="ltr" value={newOff} min={p.today} max={form.examDate} onChange={(e) => setNewOff(e.target.value)} />
              <button
                className="btn-soft text-xs"
                disabled={!newOff}
                onClick={() => {
                  if (newOff && !form.offDays.includes(newOff)) setForm({ ...form, offDays: [...form.offDays, newOff].sort() });
                  setNewOff("");
                }}
              >
                + הוסף
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-primary text-sm" disabled={saving} onClick={() => save({})}>
              שמור
            </button>
            <button className="btn-ghost text-sm" disabled={saving} onClick={() => save({ enabled: !form.enabled })}>
              {form.enabled ? "כבה את התוכנית" : "הפעל את התוכנית"}
            </button>
            <span className="text-xs text-slate-500">{msg}</span>
          </div>
          <div className="text-xs text-slate-500">
            💡 התוכנית מחושבת מחדש בכל פתיחה מההתקדמות של נגה: סוג תרגיל &quot;מוכן&quot; = 2 כוכבים או ~75% הצלחה ב-6+ תרגילים; לכל סוג שלא מוכן 3–8 תרגילים לפי הפער (~{p.avgMinPerEx} דק׳ לתרגיל בממוצע אצלה). הסדר = סדר המסלול; 3/4 למידה + 1/4 חזרה; יום לפני המבחן חזרה מעורבת. מה שהיא עושה נספר גם אם לא נכנסה דרך התוכנית.
          </div>
        </div>
      )}

      {p.status === "disabled" ? (
        <div className="text-sm text-slate-500">התוכנית כבויה – נגה לא רואה אותה. הפעל בהגדרות.</div>
      ) : p.status === "exam_passed" ? (
        <div className="text-sm text-slate-600">תאריך המבחן עבר. אפשר לקבוע יעד חדש בהגדרות.</div>
      ) : (
        <>
          <ReadinessBar p={p} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="font-black text-lg">{p.studyDaysLeft}</div>
              <div className="text-[11px] text-slate-500">ימי תרגול נותרו</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="font-black text-lg">{hours(p.availableMinutes)}</div>
              <div className="text-[11px] text-slate-500">זמן זמין</div>
            </div>
            <div className={`rounded-xl p-2 ${p.coverage < 0.7 ? "bg-red-50" : p.coverage < 1 ? "bg-amber-50" : "bg-emerald-50"}`}>
              <div className="font-black text-lg">{hours(p.requiredMinutes)}</div>
              <div className="text-[11px] text-slate-500">נדרש · כיסוי {Math.round(p.coverage * 100)}%</div>
            </div>
          </div>
          {p.coverage < 1 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {p.coverage < 0.7 ? "הזמן לא מספיק לכל הנושאים – " : "קצת צפוף – "}
              התוכנית מקצרת לכל סוג את מספר התרגילים. כדי לכסות הכול צריך עוד ~{hours(Math.max(0, Math.round(p.requiredMinutes / 0.85 - p.availableMinutes + p.todayMinutes)))} סה״כ (או להוריד ימי חופש / להוסיף דקות ליום).
            </div>
          )}

          <div>
            <div className="text-sm font-semibold mb-1">
              היום {today?.off ? "– חופש 🌴" : `· יעד ~${p.todayMinutes} דק׳ · בפועל ${p.todayDoneCount} תרגילים / ${p.todayDoneMinutes} דק׳`}
              {p.status === "done" && <span className="chip bg-emerald-100 text-emerald-800 text-xs mr-2">הושלם ✔</span>}
            </div>
            <div className="space-y-1.5">
              {p.todayTasks.map((t) => (
                <TaskRow key={t.typeId} t={t} linky={false} compact />
              ))}
              {!p.todayTasks.length && !today?.off && <div className="text-xs text-slate-500">אין משימות להיום.</div>}
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-700 font-semibold">הימים הבאים ({p.days.length - 1})</summary>
            <div className="mt-2 divide-y">
              {p.days.slice(1).map((d) => (
                <div key={d.date} className="py-1.5 flex gap-2 items-start text-xs">
                  <div className="w-20 shrink-0 font-semibold text-slate-700">{d.label}</div>
                  <div className="flex-1 flex flex-wrap gap-1">
                    {d.off ? (
                      <span className="text-slate-400">חופש</span>
                    ) : (
                      d.tasks.map((t, i) => (
                        <span key={i} className={`chip text-[11px] ${t.kind === "mock" ? "bg-violet-50 text-violet-800" : t.kind === "review" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-900"}`}>
                          {topicOf(t.topicId)?.emoji} {typeTitle(t.typeId)} · {t.exercises}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="text-slate-400 shrink-0">{d.off ? "" : `~${d.minutes}׳`}</div>
                </div>
              ))}
            </div>
          </details>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-700 font-semibold">7 הימים האחרונים – יעד מול בפועל</summary>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px]">
              {p.history.map((h) => {
                const ok = h.off || (h.minutes > 0 && h.actualMinutes >= h.minutes * 0.8);
                const some = h.actualMinutes > 0;
                return (
                  <div key={h.date} className={`rounded-lg p-1.5 ${h.off ? "bg-slate-50 text-slate-400" : ok ? "bg-emerald-50 text-emerald-800" : some ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                    <div className="font-semibold">{h.label.replace("יום ", "")}</div>
                    <div>{h.off ? "חופש" : `${h.actualMinutes}/${h.minutes}׳`}</div>
                    <div className="text-slate-500">{h.actualCount ? `${h.actualCount} תר׳` : "–"}</div>
                  </div>
                );
              })}
            </div>
          </details>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-700 font-semibold">מוכנות לפי נושא</summary>
            <div className="mt-2 grid sm:grid-cols-2 gap-1.5">
              {TOPICS.map((topic) => {
                const ns = p.needs.filter((n) => n.topicId === topic.id);
                return (
                  <div key={topic.id} className="rounded-lg border p-2 text-xs">
                    <div className="font-semibold mb-1">
                      {topic.emoji} {topic.title.split(" – ")[0]}
                    </div>
                    {ns.map((n) => (
                      <div key={n.typeId} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${n.readiness === "ready" ? "bg-emerald-500" : n.readiness === "almost" ? "bg-amber-400" : n.readiness === "started" ? "bg-orange-300" : "bg-slate-300"}`} />
                        <span className="flex-1 truncate">{n.title}</span>
                        <span className="text-slate-500">
                          {READINESS_LABEL[n.readiness]} · {Math.round(n.mastery * 100)}% · {n.attempts} תר׳
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </details>
          <div className="text-xs text-slate-500">
            נגה רואה את זה ב-<Link href="/plan" className="underline">/plan</Link> ובכרטיס במסך הראשי.
          </div>
        </>
      )}
    </section>
  );
}
