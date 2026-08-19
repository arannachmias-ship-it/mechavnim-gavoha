"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOPICS, ALL_TYPES } from "@/content/topics";
import { MISTAKE_LABELS } from "@/lib/progress";
import { useProgress } from "@/lib/client";
import TopBar from "@/components/TopBar";
import { Math as M, Txt } from "@/components/MathText";
import AnthropicKeyCard from "@/components/AnthropicKeyCard";

const heat = (m: number, attempts: number) => {
  if (!attempts) return "bg-slate-100 text-slate-400";
  if (m >= 0.85) return "bg-emerald-500 text-white";
  if (m >= 0.6) return "bg-emerald-300";
  if (m >= 0.35) return "bg-amber-300";
  return "bg-red-300";
};

export default function ParentPage() {
  const { summary, error, reload } = useProgress();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };
  if (!summary) return <main className="p-6 text-slate-500">טוען…</main>;
  const maxMin = Math.max(1, ...summary.days.map((d) => d.minutes));
  const dayNames = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  const an = summary.analytics;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <>
      <TopBar summary={summary} title="👨‍👧 מסך הורה – נגה" onRefresh={handleRefresh} refreshing={refreshing} />
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

        {summary.todayCount > 0 && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-sm">
            היום {summary.todayCount} תרגילים, {an.todayWrong} {an.todayWrong === 1 ? "טעות" : "טעויות"}. כל טעות פה היא טעות שלא תקרה בבגרות.
          </section>
        )}

        <section className="card">
          <h2 className="font-bold mb-1">איך היא עובדת – הנתונים שסיכמנו לאסוף</h2>
          <div className="text-xs text-slate-500 mb-3">זמן לתרגיל · היסוס (זמן עד ההקלדה הראשונה) · רמזים · סוג טעות · אורך רצף · שעה ביום · נטישה. אחרי כמה שבועות נדע כמה תרגילים ברצף לפני שהיא מתעייפת, ובאיזו שעה היא הכי חדה.</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {[
              ["⏱ זמן ממוצע לתרגיל", an.avgDurationSec ? `${an.avgDurationSec}s` : "—"],
              ["🤔 היסוס ממוצע", an.avgFirstInputSec !== null ? `${an.avgFirstInputSec}s` : "—"],
              ["🚪 נטישות (דילוגים)", an.skipped],
              ["🗓 מפגשים", an.sessions],
              ["🧮 מחשבון", summary.totalAttempts ? `${an.calcExercises}/${summary.totalAttempts} תרגילים · ${an.calcTotalUses} חישובים` : "—"],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl bg-slate-50 p-2 text-center">
                <div className="text-xl font-black text-slate-800">{v}</div>
                <div className="text-[11px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold text-sm mb-1">דיוק לפי מיקום במפגש (רצף)</div>
              {an.byPosition.length === 0 ? (
                <div className="text-slate-500 text-sm">עדיין אין נתונים.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-slate-500 text-xs">
                    <tr><th className="text-right">תרגיל מס'</th><th>כמה</th><th>נקי (בלי טעות/רמז)</th><th>עם רמז</th></tr>
                  </thead>
                  <tbody>
                    {an.byPosition.map((b) => (
                      <tr key={b.label} className="border-t">
                        <td className="py-1">{b.label}</td>
                        <td className="text-center">{b.count}</td>
                        <td className="text-center font-bold">{pct(b.accuracy)}</td>
                        <td className="text-center">{pct(b.hintRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="text-[11px] text-slate-400 mt-1">מפגש = תרגילים ברצף עם הפסקה של פחות מ-25 דק'. אם הדיוק צונח אחרי תרגיל 7 – זה אורך המפגש הנכון לה.</div>
            </div>
            <div>
              <div className="font-semibold text-sm mb-1">דיוק לפי שעה ביום</div>
              {an.byHour.length === 0 ? (
                <div className="text-slate-500 text-sm">צריך לפחות 3 תרגילים בשעה נתונה.</div>
              ) : (
                <div className="flex items-end gap-1 h-24">
                  {an.byHour.map((h) => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-1" title={`${h.hour}:00 – ${h.count} תרגילים, ${pct(h.accuracy)} נכון בלי הצגה`}>
                      <div className={`w-full rounded-t ${h.accuracy >= 0.75 ? "bg-emerald-400" : h.accuracy >= 0.5 ? "bg-amber-400" : "bg-red-300"}`} style={{ height: `${Math.max(4, h.accuracy * 80)}px` }} />
                      <div className="text-[9px] text-slate-500">{h.hour}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                    {new Date(r.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })} · {r.type_id === "custom" ? "📷 מהצילום" : (ALL_TYPES.find((t) => t.id === r.type_id)?.title ?? r.type_id)} · רמה {r.level}
                  </span>
                  <span>
                    {r.skipped ? "🚪 דילגה" : r.correct ? "✔" : "✘"} · {r.duration_sec}s{typeof r.first_input_sec === "number" ? ` · 🤔${r.first_input_sec}s` : ""} · 💡{r.hints} · 👀{r.reveals} · ✘{r.wrong_lines}{r.calc_uses ? ` · 🧮${r.calc_uses}` : ""}
                    {r.mistakes?.length ? ` · ${[...new Set(r.mistakes)].map((m) => MISTAKE_LABELS[m]?.split(" (")[0] ?? m).join(", ")}` : ""}
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
        <AnthropicKeyCard />

        <div className="text-center space-y-2">
          <button
            className="btn-ghost text-sm text-red-600"
            onClick={async () => {
              if (!confirm("למחוק את כל נתוני התרגול של נגה? זה בלתי הפיך.")) return;
              if (!confirm("בטוח? כל ההיסטוריה, הנקודות והרצף יימחקו.")) return;
              const r = await fetch("/api/admin", { method: "DELETE" });
              const j = await r.json().catch(() => ({}));
              alert(j.ok ? `נמחקו ${j.deleted} רשומות.` : "לא הצליח.");
              location.reload();
            }}
          >
            🗑 מחיקת כל נתוני התרגול (למשל אחרי בדיקות)
          </button>
          <br />
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
