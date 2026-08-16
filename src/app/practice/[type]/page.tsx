"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TOPIC_BY_ID, TYPE_TO_TOPIC } from "@/content/topics";
import { generate } from "@/lib/math/generators";
import { checkLine } from "@/lib/math/engine";
import type { Exercise, CheckResult } from "@/lib/math/types";
import { useProgress, logAttempt } from "@/lib/client";
import { xpFor } from "@/lib/progress";
import TopBar from "@/components/TopBar";
import { Math as M, RichText } from "@/components/MathText";
import MathField, { type MathFieldHandle } from "@/components/MathField";

const PRAISE = ["יפה!", "מעולה!", "בול!", "ככה בדיוק!", "וואו, מהר!", "אלופה!", "סטאלין היה גאה 😄", "הבחור עם המגנטים מרוצה 🧲", "חתולים מאוחדים 🐱"];

function mistakeKey(res: CheckResult, ex: Exercise): string {
  const m = res.message;
  if (res.status === "unparsable") return "parse";
  if (/מינוס|סימן|הופך/.test(m)) return "sign";
  if (/נשיקה|מגנט/.test(m)) return "kiss";
  if (/צמצם|צמצום/.test(m)) return "cancel";
  if (/משפח/.test(m)) return "families";
  if (ex.kind === "system") return "gulag";
  if (ex.kind === "equation") return /הציבי|פתרונות/.test(m) ? "final" : "mirror";
  if (/שבר|טרומפלדור/.test(m)) return "fraction";
  return "other";
}

export default function PracticePage() {
  const params = useParams<{ type: string }>();
  const typeId = params.type;
  const topicId = TYPE_TO_TOPIC[typeId];
  const topic = TOPIC_BY_ID[topicId];
  const typeInfo = topic?.types.find((t) => t.id === typeId);
  const router = useRouter();
  const { summary, error, reload } = useProgress();

  const [level, setLevel] = useState(1);
  const [ex, setEx] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0); // 0 none, 1 hint, 2 strong hint
  const [hintsUsed, setHintsUsed] = useState(0);
  const [reveals, setReveals] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [xpGain, setXpGain] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [cleanRun, setCleanRun] = useState(0);
  const [shake, setShake] = useState(0);
  const [showFinal, setShowFinal] = useState(false);
  const startRef = useRef<number>(Date.now());
  const fieldRef = useRef<MathFieldHandle>(null);
  const levelInit = useRef(false);

  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  const newExercise = useCallback(
    (lv: number) => {
      setEx(generate(typeId, lv));
      setHistory([]);
      setResult(null);
      setHintLevel(0);
      setHintsUsed(0);
      setReveals(0);
      setWrongCount(0);
      setMistakes([]);
      setDone(false);
      setShowFinal(false);
      startRef.current = Date.now();
      fieldRef.current?.clear();
      setTimeout(() => fieldRef.current?.focus(), 100);
    },
    [typeId]
  );

  // initial level from progress (or fallback after 1.5s)
  useEffect(() => {
    if (!summary || levelInit.current) return;
    levelInit.current = true;
    const tp = summary.types[typeId];
    let lv = tp?.lastLevel ?? 1;
    if (tp && tp.mastery > 0.8 && lv < 3) lv++;
    setLevel(lv);
    newExercise(lv);
  }, [summary, typeId, newExercise]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!levelInit.current) {
        levelInit.current = true;
        newExercise(1);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [newExercise]);

  const currentStage = useMemo(() => {
    if (!ex) return 0;
    if (!history.length) return 0;
    // stage of the last accepted line
    return result?.stage ?? 0;
  }, [ex, history, result]);

  const stageInfo = ex?.stages[Math.min(currentStage, ex.stages.length - 1)];

  function finish(exercise: Exercise, hist: string[], extraReveal = 0) {
    const dur = Math.round((Date.now() - startRef.current) / 1000);
    const rev = reveals + extraReveal;
    const correct = true;
    const gain = xpFor({ correct, hints: hintsUsed, reveals: rev, level: exercise.level });
    setXpGain(gain);
    setDone(true);
    setSessionCount((c) => c + 1);
    const clean = hintsUsed === 0 && rev === 0 && wrongCount === 0;
    const nextClean = clean ? cleanRun + 1 : 0;
    setCleanRun(nextClean);
    logAttempt({
      type_id: exercise.typeId,
      topic_id: exercise.topicId,
      level: exercise.level,
      correct,
      hints: hintsUsed,
      reveals: rev,
      wrong_lines: wrongCount,
      duration_sec: Math.min(dur, 3600),
      lines: hist.slice(-40),
      prompt: exercise.promptLatex.slice(0, 500),
      mistakes,
    }).then(reload);
    // adaptive level
    if (nextClean >= 3 && level < 3) {
      setLevel(level + 1);
      setCleanRun(0);
    }
  }

  function submit() {
    if (!ex || done) return;
    const raw = fieldRef.current?.getValue() ?? "";
    if (!raw.trim()) return;
    const res = checkLine(ex, history, raw);
    setResult(res);
    if (res.status === "ok" || res.status === "done") {
      const hist = [...history, raw];
      setHistory(hist);
      fieldRef.current?.clear();
      setHintLevel(0);
      if (res.status === "done") finish(ex, hist);
      else setTimeout(() => fieldRef.current?.focus(), 30);
    } else if (res.status === "wrong" || res.status === "unparsable") {
      setWrongCount((c) => c + 1);
      setMistakes((m) => [...m, mistakeKey(res, ex)]);
      setShake((s) => s + 1);
      if (wrongCount + 1 >= 2 && level > 1 && res.status === "wrong") {
        // gentle: after several wrongs on hard level, next exercise easier
      }
    }
  }

  function specialAnswer(text: string) {
    if (!ex || done) return;
    const res = checkLine(ex, history, text);
    setResult(res);
    if (res.status === "done") {
      const hist = [...history, text];
      setHistory(hist);
      finish(ex, hist);
    } else {
      setWrongCount((c) => c + 1);
      setMistakes((m) => [...m, "final"]);
      setShake((s) => s + 1);
    }
  }

  function askHint() {
    if (!ex || done) return;
    if (hintLevel < 2) {
      setHintLevel(hintLevel + 1);
      setHintsUsed((h) => h + 1);
    }
  }

  function revealStep() {
    if (!ex || done) return;
    // first canonical step beyond current stage
    const stg = currentStage;
    let step = ex.steps.find((s) => s.stage > stg);
    if (!step) step = ex.steps[ex.steps.length - 1];
    // avoid revealing a step already present
    const already = history.some((h) => h.replace(/\s/g, "") === step!.latex.replace(/\s/g, ""));
    if (already) {
      const idx = ex.steps.indexOf(step);
      step = ex.steps[Math.min(idx + 1, ex.steps.length - 1)];
    }
    const hist = [...history, step.latex];
    setHistory(hist);
    setReveals((r) => r + 1);
    setHintLevel(0);
    const res = checkLine(ex, history, step.latex.replace(/\\ /g, " "));
    setResult({ ...res, message: `👀 ${step.note}` });
    if (res.status === "done" || step === ex.steps[ex.steps.length - 1]) {
      finish(ex, hist, 1);
    } else setTimeout(() => fieldRef.current?.focus(), 30);
  }

  function next() {
    // level down if struggled a lot
    let lv = level;
    if (wrongCount >= 4 && lv > 1) lv--;
    setLevel(lv);
    newExercise(lv);
  }

  if (!topic || !typeInfo) return <main className="p-6">סוג תרגיל לא נמצא</main>;

  return (
    <>
      <TopBar summary={summary} back={`/learn/${topicId}`} title={`🎯 ${typeInfo.title}`} />
      <main className="max-w-3xl mx-auto w-full p-4 pb-40 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="chip bg-slate-100">רמה {"⭐".repeat(level)}</span>
          <span className="chip bg-slate-100">היום בסשן: {sessionCount}</span>
          {stageInfo && !done && <span className="chip bg-amber-100 text-amber-800 truncate">שלב: {stageInfo.name}</span>}
        </div>

        {ex && (
          <div className={`card border-2 ${done ? "border-emerald-300 bg-emerald-50" : "border-amber-200"}`}>
            <div className="text-slate-600 text-sm mb-1">{ex.instruction}</div>
            <div className="text-2xl sm:text-3xl py-2">
              <M latex={ex.promptLatex} block />
            </div>
          </div>
        )}

        {/* accepted lines */}
        {history.length > 0 && (
          <div className="card space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 animate-pop">
                <span className="text-emerald-600">✔</span>
                <div className="text-xl flex-1">
                  <M latex={h.replace(/כל x/g, "\\text{כל } x").replace(/אין פתרון/g, "\\text{אין פתרון}")} block />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* feedback */}
        {result && !done && (
          <div key={shake} className={`rounded-xl p-3 text-sm leading-relaxed ${result.status === "ok" ? "bg-emerald-50 text-emerald-800" : result.status === "wrong" || result.status === "unparsable" ? "bg-red-50 text-red-800 animate-shake" : "bg-slate-50 text-slate-700"}`}>
            {result.status === "ok" && !result.message.startsWith("👀") ? `✔ ${PRAISE[(history.length * 7 + sessionCount) % PRAISE.length]} ${result.message}` : result.message}
          </div>
        )}

        {/* hints */}
        {!done && ex && (
          <div className="space-y-2">
            {hintLevel >= 1 && stageInfo && (
              <div className="rounded-xl p-3 bg-sky-50 text-sky-900 animate-pop">
                💡 <b>{stageInfo.name}:</b> <RichText text={stageInfo.hint1} />
              </div>
            )}
            {hintLevel >= 2 && stageInfo && (
              <div className="rounded-xl p-3 bg-violet-50 text-violet-900 animate-pop">
                💡💡 <RichText text={stageInfo.hint2} />
              </div>
            )}
          </div>
        )}

        {/* done */}
        {done && ex && (
          <div className="card border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white animate-pop space-y-3">
            <div className="text-2xl font-black text-emerald-700">🎉 {reveals ? "סיימנו! בפעם הבאה בלי הצגת צעד 😉" : hintsUsed ? "מצוין! נעזרת ברמז והצלחת." : "כל הכבוד – לבד לגמרי!"}</div>
            <div className="flex items-center gap-3">
              <span className="chip bg-amber-100 text-amber-800 text-base">+{xpGain} ⭐</span>
              {wrongCount > 0 && <span className="text-sm text-slate-500">({wrongCount} ניסיונות שלא הלכו – זה חלק מהעניין)</span>}
            </div>
            <div className="text-sm text-slate-600">
              תשובה סופית: <M latex={ex.finalLatex} />
              {ex.kind === "equation" && Array.isArray(ex.solutions) && " – כדאי להציב חזרה במקור ולבדוק."}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1 text-lg" onClick={next} autoFocus>
                עוד תרגיל ←
              </button>
              <Link href={`/learn/${topicId}`} className="btn-soft">
                לנושא
              </Link>
            </div>
          </div>
        )}

        {/* input area – fixed bottom */}
        {!done && ex && (
          <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t p-3 z-10">
            <div className="max-w-3xl mx-auto space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MathField ref={fieldRef} placeholder="\\text{השורה הבאה}" onEnter={submit} autoFocus keyboardHostId="kb-host" />
                </div>
                <button className="btn-primary h-[58px] px-5 text-lg" onClick={submit}>
                  בדוק
                </button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button className="btn-soft text-sm" onClick={askHint} disabled={hintLevel >= 2}>
                  💡 {hintLevel === 0 ? "רמז" : hintLevel === 1 ? "רמז חזק" : "אין עוד רמזים"}
                </button>
                <button className="btn-soft text-sm" onClick={revealStep} disabled={hintLevel < 2}>
                  👀 הצג את הצעד
                </button>
                {ex.kind === "equation" && (
                  <>
                    <button className="btn-ghost text-sm" onClick={() => specialAnswer("אין פתרון")}>
                      אין פתרון
                    </button>
                    <button className="btn-ghost text-sm" onClick={() => specialAnswer("כל x")}>
                      כל x
                    </button>
                  </>
                )}
                <button className="btn-ghost text-sm mr-auto" onClick={() => setShowFinal((s) => !s)} title="דלגי על התרגיל">
                  דלג
                </button>
              </div>
              <div id="kb-host" />
              {showFinal && (
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <span>לדלג? התרגיל יירשם כלא-פתור.</span>
                  <button
                    className="btn-soft text-xs"
                    onClick={() => {
                      logAttempt({ type_id: ex.typeId, topic_id: ex.topicId, level: ex.level, correct: false, hints: hintsUsed, reveals, wrong_lines: wrongCount, duration_sec: Math.min(Math.round((Date.now() - startRef.current) / 1000), 3600), lines: history, prompt: ex.promptLatex.slice(0, 500), mistakes: [...mistakes, "final"] }).then(reload);
                      const lv = level > 1 ? level - 1 : 1;
                      setLevel(lv);
                      newExercise(lv);
                    }}
                  >
                    כן, דלגי
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
