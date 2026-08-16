"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TOPICS, RECOMMENDED_PATH, BADGES } from "@/content/topics";
import { useProgress } from "@/lib/client";
import TopBar from "@/components/TopBar";
import { Txt } from "@/components/MathText";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-500 text-sm tracking-tight">
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(3 - n)}</span>
    </span>
  );
}

export default function LearnHome() {
  const { summary, error } = useProgress();
  const router = useRouter();
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  const nextTopicId = summary ? RECOMMENDED_PATH.find((id) => (summary.topics[id]?.stars ?? 0) < 2) ?? RECOMMENDED_PATH[0] : RECOMMENDED_PATH[0];
  const nextTopic = TOPICS.find((t) => t.id === nextTopicId)!;

  return (
    <>
      <TopBar formulas summary={summary} title="היי נגה 👋" />
      <main className="max-w-3xl mx-auto w-full p-4 pb-16 space-y-5">
        {summary && (
          <section className="grid grid-cols-3 gap-2">
            <div className="card text-center py-3">
              <div className="text-2xl font-black text-amber-600">{summary.level}</div>
              <div className="text-xs text-slate-500">רמה</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-black text-orange-600">{summary.streak}🔥</div>
              <div className="text-xs text-slate-500">ימים ברצף</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-black text-emerald-600">{summary.todayCount}</div>
              <div className="text-xs text-slate-500">תרגילים היום</div>
            </div>
          </section>
        )}

        <section className="card border-2 border-amber-300 bg-amber-50">
          <div className="text-sm text-amber-800 font-semibold">הצעד הבא במסלול</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-4xl">{nextTopic.emoji}</span>
            <div className="flex-1">
              <div className="font-bold text-lg">{nextTopic.title}</div>
              <div className="text-sm text-slate-600"><Txt s={nextTopic.subtitle} /></div>
            </div>
            <Link href={`/learn/${nextTopic.id}`} className="btn-primary">
              יאללה
            </Link>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-2">מפת הנושאים</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TOPICS.map((t, i) => {
              const p = summary?.topics[t.id];
              return (
                <Link key={t.id} href={`/learn/${t.id}`} className={`card ${t.color} border-0 hover:shadow-md transition flex items-center gap-3`}>
                  <span className="text-3xl">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold leading-tight">
                      <span className="text-slate-400 text-sm ml-1">{i + 1}.</span>
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-600 truncate"><Txt s={t.subtitle} /></div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars n={p?.stars ?? 0} />
                      {p && p.attempts > 0 && <span className="text-xs text-slate-500">{p.correct}/{p.attempts} ✔</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {summary && (
          <section>
            <h2 className="font-bold text-lg mb-2">תגים</h2>
            <div className="flex flex-wrap gap-2">
              {BADGES.map((b) => {
                const has = summary.badges.includes(b.id);
                return (
                  <div key={b.id} title={b.desc} className={`chip ${has ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>
                    <span>{b.emoji}</span> {b.title}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <div className="text-center pt-4">
          <button
            className="btn-ghost text-sm"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              router.push("/");
            }}
          >
            החלפת משתמש
          </button>
        </div>
      </main>
    </>
  );
}
