"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOPIC_BY_ID } from "@/content/topics";
import { useProgress } from "@/lib/client";
import TopBar from "@/components/TopBar";
import { Math as M, RichText, Txt } from "@/components/MathText";
import Animation from "@/components/Animation";

export default function TopicPage() {
  const params = useParams<{ topic: string }>();
  const topic = TOPIC_BY_ID[params.topic];
  const { summary, error } = useProgress();
  const router = useRouter();
  const [tab, setTab] = useState<"method" | "example" | "video">("method");
  const [exStep, setExStep] = useState(0);
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);
  if (!topic) return <main className="p-6">נושא לא נמצא</main>;

  return (
    <>
      <TopBar formulas summary={summary} back="/learn" title={`${topic.emoji} ${topic.title}`} />
      <main className="max-w-3xl mx-auto w-full p-4 pb-24 space-y-4">
        <p className="text-slate-600"><Txt s={topic.subtitle} /></p>

        <div className="flex gap-2 sticky top-[52px] z-10 bg-[var(--background)] py-1">
          {(
            [
              ["method", "📖 השיטה"],
              ["example", "✍️ דוגמה"],
              ["video", "🎥 סרטונים"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`chip flex-1 justify-center py-2 ${tab === k ? "bg-amber-500 text-white" : "bg-white border"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "method" && (
          <div className="space-y-4">
            {topic.animation && <Animation id={topic.animation} />}
            {topic.cards.map((c, i) => (
              <div key={i} className="card">
                <h3 className="font-bold text-lg mb-2"><Txt s={c.title} /></h3>
                <div className="space-y-2 leading-relaxed">
                  {c.body.map((p, j) => (
                    <p key={j}>
                      <RichText text={p} />
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "example" && (
          <div className="card space-y-3">
            <div className="text-slate-500 text-sm">דוגמה פתורה – לחצי "הבא" כדי לראות צעד-צעד</div>
            <div className="text-2xl bg-slate-50 rounded-xl p-3">
              <M latex={topic.example.prompt} block />
            </div>
            <div className="space-y-2">
              {topic.example.steps.slice(0, exStep).map((s, i) => (
                <div key={i} className="animate-pop flex gap-3 items-start border-r-4 border-amber-300 pr-3">
                  <div className="flex-1">
                    <div className="text-xl">
                      <M latex={s.latex} block />
                    </div>
                    <div className="text-sm text-slate-600">
                      <RichText text={s.note} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => setExStep((s) => Math.min(topic.example.steps.length, s + 1))} disabled={exStep >= topic.example.steps.length}>
                הבא ←
              </button>
              <button className="btn-soft" onClick={() => setExStep(0)}>
                מהתחלה
              </button>
            </div>
          </div>
        )}

        {tab === "video" && (
          <div className="space-y-4">
            {topic.videoIds.length === 0 && <div className="card text-slate-500">לנושא הזה עדיין אין סרטון של אבא – יש הסבר ודוגמה 🙂</div>}
            {topic.videoIds.map((v) => (
              <div key={v.id} className="card p-2">
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${v.id}`} title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
                <div className="p-2 font-semibold">{v.title}</div>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t p-3">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto">
            {topic.types.map((ty) => {
              const tp = summary?.types[ty.id];
              return (
                <Link key={ty.id} href={`/practice/${ty.id}`} className="btn-primary flex-1 whitespace-nowrap flex-col gap-0 py-2">
                  <span>🎯 תרגול: <Txt s={ty.title} /></span>
                  <span className="text-xs font-normal opacity-90">
                    <Txt s={ty.short} />
                    {tp && tp.attempts > 0 ? ` · ${"★".repeat(tp.stars)}` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
