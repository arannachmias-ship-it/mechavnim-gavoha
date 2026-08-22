"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOPICS, RECOMMENDED_PATH, BADGES } from "@/content/topics";
import { useProgress, usePlan } from "@/lib/client";
import MissionHero, { DadNote } from "@/components/MissionHero";
import TopBar from "@/components/TopBar";
import Monogram from "@/components/Monogram";
import { Txt, Math as M } from "@/components/MathText";
import { lastResume, agoText, clearResume, type ResumeState } from "@/lib/resume";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-primary text-sm tracking-tight">
      {"★".repeat(n)}
      <span className="text-line">{"★".repeat(3 - n)}</span>
    </span>
  );
}

export default function LearnHome() {
  const { summary, profile, error } = useProgress();
  const { plan } = usePlan();
  const router = useRouter();
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  const [resume, setResume] = useState<ResumeState | null>(null);
  useEffect(() => {
    setResume(lastResume());
  }, []);

  const nextTopicId = summary ? RECOMMENDED_PATH.find((id) => (summary.topics[id]?.stars ?? 0) < 2) ?? RECOMMENDED_PATH[0] : RECOMMENDED_PATH[0];
  const nextTopic = TOPICS.find((t) => t.id === nextTopicId)!;

  return (
    <>
      <TopBar formulas tester={profile === "tester"} summary={summary} title="היי נגה" />
      <main className="max-w-3xl mx-auto w-full p-4 pb-16 space-y-5">
        {plan && <MissionHero p={plan} />}
        {plan && <DadNote note={plan.settings.note} />}

        {summary && (
          <section className="grid grid-cols-3 gap-2">
            <div className="card text-center py-3" title={`דרגה לפי נקודות ⭐. יש לך ${summary.xp}, הדרגה הבאה ב-${25 * summary.level * summary.level}.`}>
              <div className="text-2xl font-black text-gradient">{summary.level}</div>
              <div className="text-xs text-muted">דרגה (⭐ {summary.xp}/{25 * summary.level * summary.level})</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-black text-ink">{summary.streak}🔥</div>
              <div className="text-xs text-muted">ימים ברצף</div>
            </div>
            <div className="card text-center py-3">
              <div className="text-2xl font-black text-lime-ink">{summary.todayCount}</div>
              <div className="text-xs text-muted">תרגילים היום</div>
            </div>
          </section>
        )}

        {resume && (
          <section className="card !bg-primary-tint/80 !border-primary/25 space-y-2">
            <div className="text-sm text-primary-ink font-semibold">↩ עצרת באמצע {resume.title ? `– ${resume.title}` : ""} <span className="text-primary-ink/60 font-normal">({agoText(resume.savedAt)})</span></div>
            {resume.promptLatex && (
              <div className="text-xl">
                <M latex={resume.promptLatex} block />
              </div>
            )}
            <div className="flex gap-2 items-center">
              <Link href={`/practice/${resume.typeId}`} className="btn-primary flex-1 text-center">
                להמשיך מאיפה שעצרת ←
              </Link>
              <button
                className="btn-ghost text-sm"
                onClick={() => {
                  clearResume(resume.typeId);
                  setResume(null);
                }}
              >
                לא צריך
              </button>
            </div>
          </section>
        )}

        <Link href="/photo" className="card flex items-center gap-3 hover:!border-primary/40 transition">
          <span className="w-11 h-11 rounded-2xl bg-primary-tint flex items-center justify-center shrink-0" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h2.2l1.4-2h8.8l1.4 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="font-bold">יש תרגיל בדף? צלמי אותו</div>
            <div className="text-sm text-ink-soft">ואני אלווה אותך בפתרון – עם הרמזים והשיטה, כמו כאן.</div>
          </div>
          <span className="btn-soft">צלמי</span>
        </Link>

        <section className="card !border-primary/30" style={{ background: "linear-gradient(135deg, rgb(239 235 255 / .9), rgb(255 255 255 / .8))" }}>
          <div className="text-sm text-primary-ink font-semibold">הצעד הבא במסלול</div>
          <div className="flex items-center gap-3 mt-1">
            <Monogram topicId={nextTopic.id} size={44} />
            <div className="flex-1">
              <div className="font-bold text-lg">{nextTopic.title}</div>
              <div className="text-sm text-ink-soft"><Txt s={nextTopic.subtitle} /></div>
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
                <Link key={t.id} href={`/learn/${t.id}`} className="card-solid hover:shadow-md hover:border-primary/30 transition flex items-center gap-3">
                  <Monogram topicId={t.id} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold leading-tight">
                      <span className="text-muted text-sm ml-1">{i + 1}.</span>
                      {t.title}
                      {t.phase === 2 && <span className="chip !bg-primary-tint !border-primary-tint text-[10px] !text-primary-ink mr-1 align-middle !py-0.5 !px-2">שלב ב&apos;</span>}
                    </div>
                    <div className="text-xs text-muted truncate"><Txt s={t.subtitle} /></div>
                    <div className="mt-1 flex items-center gap-2">
                      <Stars n={p?.stars ?? 0} />
                      {p && p.attempts > 0 && <span className="text-xs text-muted">{p.correct}/{p.attempts} ✓</span>}
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
                  <div key={b.id} title={b.desc} className={`chip ${has ? "!bg-lime-tint !text-lime-ink !border-lime-deep/40" : "!text-faint"}`}>
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
