"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useProgress, usePlan } from "@/lib/client";
import { READINESS_LABEL, topicOf, typeTitle } from "@/lib/plan";
import { TaskRow, ReadinessBar, countdownText, examDateHe } from "@/components/PlanWidgets";
import { TOPICS } from "@/content/topics";

/**
 * 🎯 "הדרך ל-1.9" – התוכנית של נגה עד המבחן.
 * שקופה: מה היום, מה בימים הבאים, איפה היא עומדת בכל סוג, ואיך זה מחושב.
 */
export default function PlanPage() {
  const { summary, profile, error } = useProgress();
  const { plan: p, reload } = usePlan();
  const router = useRouter();
  const [showHow, setShowHow] = useState(false);
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  return (
    <>
      <TopBar back="/learn" formulas tester={profile === "tester"} summary={summary} title="🎯 הדרך למבחן" onRefresh={reload} />
      <main className="max-w-3xl mx-auto w-full p-4 pb-16 space-y-5">
        {!p && <div className="text-slate-500 text-center py-10">רגע…</div>}
        {p && p.status === "disabled" && <div className="card text-center text-slate-600">אין כרגע תוכנית פעילה. (אבא יכול להפעיל במסך ההורה.)</div>}
        {p && p.status !== "disabled" && (
          <>
            {/* כותרת + ספירה לאחור */}
            <section className="card border-2 border-rose-200 bg-gradient-to-l from-rose-50 to-white space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-5xl font-black text-rose-600 tabular-nums">{p.status === "exam_passed" ? "💛" : p.daysLeft}</div>
                <div className="flex-1">
                  <div className="font-bold text-lg leading-tight">{p.settings.examTitle}</div>
                  <div className="text-sm text-slate-600">
                    {countdownText(p)} · {examDateHe(p.examDate)}
                    {p.status !== "exam_passed" && ` · ${p.studyDaysLeft} ימי תרגול`}
                  </div>
                </div>
              </div>
              <ReadinessBar p={p} />
              {p.settings.note && <div className="text-sm text-slate-700 bg-white/70 rounded-xl px-3 py-2">💬 אבא: {p.settings.note}</div>}
              {p.status === "behind" && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  בקצב הנוכחי נספיק בערך {Math.round(p.coverage * 100)}% ממה שרציתי לכסות – אז התוכנית מתמקדת קודם במה שהכי חשוב. כל תרגיל נוסף עוזר, ואפשר לבקש מאבא להוסיף דקות.
                </div>
              )}
            </section>

            {/* היום */}
            {p.status !== "exam_passed" && (
              <section className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-bold text-lg">היום</h2>
                  <span className="text-sm text-slate-500">
                    {p.days[0]?.off ? "יום חופש 🌴" : `יעד ~${p.todayMinutes} דק׳ · עשית ${p.todayDoneCount} תרגילים (${p.todayDoneMinutes} דק׳)`}
                  </span>
                </div>
                {p.days[0]?.off && <div className="card text-sm text-slate-600">היום לא מתוכנן כלום. אם בא לך – כל תרגיל שתעשי נספר ומקדם את התוכנית.</div>}
                {p.todayTasks.map((t) => (
                  <TaskRow key={t.typeId} t={t} />
                ))}
                {p.status === "done" && <div className="card border-2 border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold text-center">סיימת את היום ✔ מחר ממשיכים. רוצה עוד? כל תרגיל נוסף מקדם אותך במוכנות.</div>}
              </section>
            )}

            {/* הימים הבאים */}
            {p.days.length > 1 && (
              <section className="space-y-2">
                <h2 className="font-bold text-lg">הימים הבאים</h2>
                <div className="card divide-y">
                  {p.days.slice(1).map((d) => (
                    <div key={d.date} className="py-2 flex gap-3 items-start">
                      <div className="w-24 shrink-0 text-sm font-semibold text-slate-700">{d.label}</div>
                      <div className="flex-1 text-sm text-slate-600 flex flex-wrap gap-x-2 gap-y-1">
                        {d.off ? (
                          <span className="text-slate-400">חופש 🌴</span>
                        ) : (
                          d.tasks.map((t, i) => (
                            <span key={i} className={`chip text-xs ${t.kind === "mock" ? "bg-violet-50 text-violet-800" : t.kind === "review" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-900"}`}>
                              {topicOf(t.topicId)?.emoji} {typeTitle(t.typeId)} · {t.exercises}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="text-xs text-slate-400 shrink-0">{d.off ? "" : `~${d.minutes} דק׳`}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  💡 התוכנית מתעדכנת כל יום לפי מה שכבר עשית – אם פספסת יום, העבודה נפרסת מחדש על מה שנשאר; אם סיימת נושא מהר, מתפנה זמן.
                </div>
              </section>
            )}

            {/* איפה אני עומדת */}
            <section className="space-y-2">
              <h2 className="font-bold text-lg">איפה אני עומדת</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {TOPICS.map((topic) => {
                  const ns = p.needs.filter((n) => n.topicId === topic.id);
                  return (
                    <div key={topic.id} className={`rounded-xl border p-3 ${topic.color} border-0`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{topic.emoji}</span>
                        <div className="font-semibold text-sm leading-tight flex-1 truncate">{topic.title.split(" – ")[0]}</div>
                        <Link href={`/learn/${topic.id}`} className="text-xs text-slate-500 underline">
                          השיטה
                        </Link>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {ns.map((n) => (
                          <Link key={n.typeId} href={`/practice/${n.typeId}`} className="flex items-center gap-2 text-xs hover:underline">
                            <span className={`w-2.5 h-2.5 rounded-full ${n.readiness === "ready" ? "bg-emerald-500" : n.readiness === "almost" ? "bg-amber-400" : n.readiness === "started" ? "bg-orange-300" : "bg-slate-300"}`} />
                            <span className="flex-1 truncate">{n.title}</span>
                            <span className="text-slate-600">{READINESS_LABEL[n.readiness]}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* איך זה מחושב */}
            <section className="text-sm">
              <button className="btn-ghost text-sm" onClick={() => setShowHow((v) => !v)}>
                ⓘ איך התוכנית מחושבת {showHow ? "▲" : "▼"}
              </button>
              {showHow && (
                <div className="card text-slate-700 space-y-2 leading-relaxed">
                  <p>
                    <b>מוכן</b> = 2 כוכבים בסוג התרגיל, או הצלחה יציבה (בערך 75% בתרגילים האחרונים, לפחות 6 תרגילים). <b>כמעט</b> = בדרך לשם. לכל סוג שעוד לא מוכן התוכנית מקצה כ-3–8 תרגילים, לפי הפער; לסוג מוכן – 2 לתחזוקה.
                  </p>
                  <p>
                    הסדר הוא סדר המסלול (כל נושא נשען על הקודם). בכל יום ≈ 3/4 למידה של מה שהבא בתור + 1/4 חזרה על משהו שכבר נלמד. יום לפני המבחן: חזרה מעורבת – תרגיל אחד מכל סוג.
                  </p>
                  <p>
                    הזמן ליום נקבע על ידי אבא (עכשיו: {p.settings.minutesPerDay} דק׳ ביום רגיל, {p.settings.weekendMinutes} בסופ״ש{p.settings.offDays.length ? `, ${p.settings.offDays.length} ימי חופש` : ""}). תרגיל שנעשה נספר ✔ בכל מקום שתגיעי אליו – לא חייבים דרך התוכנית. ממוצע היום: ~{p.avgMinPerEx} דק׳ לתרגיל.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
