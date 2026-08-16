"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TOPICS, ALL_TYPES } from "@/content/topics";
import { MISTAKE_LABELS } from "@/lib/progress";
import { useProgress } from "@/lib/client";
import TopBar from "@/components/TopBar";
import { Math as M, Txt } from "@/components/MathText";

const heat = (m: number, attempts: number) => {
  if (!attempts) return "bg-slate-100 text-slate-400";
  if (m >= 0.85) return "bg-emerald-500 text-white";
  if (m >= 0.6) return "bg-emerald-300";
  if (m >= 0.35) return "bg-amber-300";
  return "bg-red-300";
};

export default function ParentPage() {
  const { summary, error } = useProgress();
  const router = useRouter();
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);
  if (!summary) return <main className="p-6 text-slate-500">טוען…</main>;
  const maxMin = Math.max(1, ...summary.days.map((d) => d.minutes));
  const dayNames = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return (
    <>
      <TopBar summary={summary} title="👨‍👧 מסך הורה – נגה" />
      <main className="max-w-3xl mx-auto w-full p-4 pb-16 space-y-5">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["⭐ נקודות", summary.xp],
            ["🔥 רצף ימים", summary.streak],
            ["⏱ דקות היום", summary.todayMinutes],
            ["✔ נפתרו סה\"כ", `${summary.totalCorrect}/${summary.totalAttempts}`],
          ].map(([l, v]) => (
            <div key={String(l)} className="card text-center py-3">
              <div className="text-2xl font-black text-amber-700">{v}</div>
              <div className="text-xs text-slate-500">{l}</div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2 className="font-bold mb-2">שליטה לפי נושא (מפת חום)</h2>
          <div className="space-y-2">
            {TOPICS.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="w-40 text-sm truncate">
                  {t.emoji} {t.title.split(" – ")[0]}
                </div>
                <div className="flex-1 flex gap-1">
                  {t.types.map((ty) => {
                    const tp = summary.types[ty.id];
                    return (
                      <div key={ty.id} className={`flex-1 rounded-lg px-2 py-1 text-xs text-center ${heat(tp?.mastery ?? 0, tp?.attempts ?? 0)}`} title={`${ty.title}: ${tp?.correct ?? 0}/${tp?.attempts ?? 0}, רמזים ${tp?.hints ?? 0}, הצגות ${tp?.reveals ?? 0}`}>
                        <Txt s={ty.title} />
                        <div className="opacity-80">
                          {tp?.attempts ? `${Math.round((tp.mastery ?? 0) * 100)}% · ${"★".repeat(tp.stars)}` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-2">ירוק = שולטת (פותרת לבד ברמה גבוהה), צהוב = בדרך, אדום = נתקעת. אחוז = 'שליטה' על סמך 8 התרגילים האחרונים, עם משקל נמוך יותר לרמזים והצגת צעדים.</div>
        </section>

        <section className="card">
          <h2 className="font-bold mb-2">זמן תרגול – 4 שבועות אחרונים</h2>
          <div className="flex items-end gap-[3px] h-24">
            {summary.days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${Math.round(d.minutes)} דק', ${d.count} תרגילים`}>
                <div className={`w-full rounded-t ${d.count ? "bg-amber-400" : "bg-slate-100"}`} style={{ height: `${Math.max(3, (d.minutes / maxMin) * 80)}px` }} />
                <div className="text-[9px] text-slate-400">{dayNames[new Date(d.date).getDay()]}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            סה"כ {summary.totalMinutes} דקות. היום {summary.todayMinutes} דק' ו-{summary.todayCount} תרגילים.
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="font-bold mb-2">איפה היא נתקעת</h2>
            {summary.mistakes.length === 0 ? (
              <div className="text-slate-500 text-sm">עדיין אין מספיק נתונים.</div>
            ) : (
              <ul className="space-y-1 text-sm">
                {summary.mistakes.map((m) => (
                  <li key={m.key} className="flex justify-between">
                    <span>{MISTAKE_LABELS[m.key] ?? m.key}</span>
                    <b>{m.count}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="font-bold mb-2">רמזים והצגת צעדים</h2>
            <ul className="space-y-1 text-sm">
              {ALL_TYPES.filter((t) => summary.types[t.id]?.attempts).map((t) => {
                const tp = summary.types[t.id];
                return (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate"><Txt s={t.title} /></span>
                    <span className="text-slate-600 whitespace-nowrap">
                      💡 {tp.hints} · 👀 {tp.reveals} · {tp.attempts} תרגילים
                    </span>
                  </li>
                );
              })}
              {!ALL_TYPES.some((t) => summary.types[t.id]?.attempts) && <li className="text-slate-500">עדיין לא תרגלה.</li>}
            </ul>
          </div>
        </section>

        <section className="card">
          <h2 className="font-bold mb-2">תרגילים אחרונים – עם הצעדים שהקלידה</h2>
          <div className="space-y-3">
            {summary.recent.map((r) => (
              <div key={r.id} className={`rounded-xl border p-3 ${r.correct ? "border-emerald-200" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {new Date(r.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })} · {ALL_TYPES.find((t) => t.id === r.type_id)?.title ?? r.type_id} · רמה {r.level}
                  </span>
                  <span>
                    {r.correct ? "✔" : "✘"} · {r.duration_sec}s · 💡{r.hints} · 👀{r.reveals} · ✘{r.wrong_lines}
                  </span>
                </div>
                <div className="text-lg mt-1">
                  <M latex={r.prompt} block />
                </div>
                <div className="pr-3 border-r-2 border-slate-200 mt-1 space-y-1">
                  {r.lines.map((l, i) => (
                    <div key={i} className="text-base">
                      <M latex={l.replace(/כל x/g, "\\text{כל } x").replace(/אין פתרון/g, "\\text{אין פתרון}")} block />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {summary.recent.length === 0 && <div className="text-slate-500 text-sm">עדיין אין תרגילים.</div>}
          </div>
        </section>
        <div className="text-center">
          <button
            className="btn-ghost text-sm"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              router.push("/");
            }}
          >
            יציאה
          </button>
        </div>
      </main>
    </>
  );
}
