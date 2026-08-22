"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TOPIC_BY_ID, TYPE_TO_TOPIC } from "@/content/topics";
import { generate, generateWithSeed } from "@/lib/math/generators";
import { parenCount } from "@/lib/math/check";
import { exerciseVariables } from "@/lib/math/vars";
import { checkLine } from "@/lib/math/engine";
import type { Exercise, CheckResult } from "@/lib/math/types";
import { useProgress, logAttempt } from "@/lib/client";
import { xpFor } from "@/lib/progress";
import TopBar from "@/components/TopBar";
import { Math as M, RichText, Txt } from "@/components/MathText";
import MathField, { type MathFieldHandle } from "@/components/MathField";
import LevelRing from "@/components/LevelRing";
import FormulaSheet from "@/components/FormulaSheet";
import MethodSheet from "@/components/MethodSheet";
import { shouldPushMethod } from "@/lib/method";
import CoordPlot from "@/components/CoordPlot";
import Calculator from "@/components/Calculator";
import { geoChecklist } from "@/lib/math/geo";
import { PRAISE_NORMAL, PRAISE_HARD, PRAISE_MILESTONE, AFTER_STRUGGLE, Rotator, sessionSummary } from "@/content/voice";
import { saveResume, loadResume, clearResume, SESSION_MAX_AGE_MS, type ResumeState } from "@/lib/resume";

/** התרגיל שהגיע מצילום נשמר ב-localStorage (שורד סגירת דף), עם נפילה ל-sessionStorage מגרסאות קודמות */
function readCustomEx(): string | null {
  try {
    return localStorage.getItem("mg_custom_ex") ?? sessionStorage.getItem("mg_custom_ex");
  } catch {
    return null;
  }
}

function mistakeKey(res: CheckResult, ex: Exercise): string {
  if (res.mistake) return res.mistake;
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
  const isCustom = typeId === "custom";
  const topicId = isCustom ? "photo" : TYPE_TO_TOPIC[typeId];
  const topic = isCustom ? { id: "photo", emoji: "📷", title: "מהצילום", types: [{ id: "custom", title: "תרגיל מהצילום", short: "" }] } : TOPIC_BY_ID[topicId];
  const typeInfo = topic?.types.find((t) => t.id === typeId);
  const router = useRouter();
  const { summary, profile, error, reload } = useProgress();

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
  /** זמן פעיל בתרגיל – לא סופרים את הדקות שהיא בוואטסאפ / האפליקציה ברקע */
  const timeRef = useRef({ acc: 0, since: Date.now(), hidden: false });
  /** שניות עד ההקלדה הראשונה (מתוך הזמן הפעיל) */
  const firstInputRef = useRef<number | null>(null);
  const seedRef = useRef<number | undefined>(undefined);
  const customRawRef = useRef<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const fieldRef = useRef<MathFieldHandle>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);
  const levelInit = useRef(false);
  const rot = useRef(new Rotator());
  const [sessionWrong, setSessionWrong] = useState(0);
  const [praise, setPraise] = useState<{ head: string; sub?: string; tier: "normal" | "hard" | "milestone" } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  /** שקיפות הרמה: מה קרה לרמה ולמה, וחלון "איך עולים רמה?" */
  const [levelNote, setLevelNote] = useState<{ kind: "up" | "down"; text: string } | null>(null);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  /** 🧮 כמה פעמים חישבה במחשבון של האפליקציה בתרגיל הזה (נרשם למסך ההורה) */
  const [calcUses, setCalcUses] = useState(0);

  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  const activeMs = useCallback(() => {
    const t = timeRef.current;
    return t.acc + (t.hidden ? 0 : Date.now() - t.since);
  }, []);
  const resetTime = useCallback((acc = 0) => {
    timeRef.current = { acc, since: Date.now(), hidden: typeof document !== "undefined" ? document.hidden : false };
  }, []);

  const reviveCustom = useCallback((raw: string): Exercise => {
    const parsed = JSON.parse(raw) as Exercise;
    parsed.stageOf = (info) => {
      const pc = (info.node ? parenCount(info.node) : 0) + (info.lhs ? parenCount(info.lhs) : 0) + (info.rhs ? parenCount(info.rhs) : 0);
      return pc > 0 ? 0 : Math.min(1, parsed.stages.length - 1);
    };
    return parsed;
  }, []);

  /** תרגיל חדש, או שחזור של תרגיל שנקטע (restore) */
  const newExercise = useCallback(
    (lv: number, restore?: ResumeState) => {
      let exercise: Exercise;
      if (isCustom) {
        const raw = restore?.customEx ?? readCustomEx();
        if (!raw) {
          router.replace("/photo");
          return;
        }
        try {
          exercise = reviveCustom(raw);
        } catch {
          router.replace("/photo");
          return;
        }
        customRawRef.current = raw;
        seedRef.current = undefined;
      } else if (restore && restore.seed !== undefined) {
        exercise = generate(typeId, restore.level, restore.seed);
        seedRef.current = restore.seed;
      } else {
        const g = generateWithSeed(typeId, lv);
        exercise = g.ex;
        seedRef.current = g.seed;
      }

      if (restore) {
        // האם השורה האחרונה שכבר אושרה סיימה את התרגיל? אם כן – מתחילים תרגיל חדש
        let last: CheckResult | null = null;
        if (restore.history.length) {
          try {
            last = checkLine(exercise, restore.history.slice(0, -1), restore.history[restore.history.length - 1]);
          } catch {
            last = null;
          }
          if (last?.status === "done") restore = undefined;
        }
        if (restore) {
          setEx(exercise);
          setHistory(restore.history);
          setResult(last);
          setHintLevel(restore.hintLevel);
          setCalcUses(restore.calcUses ?? 0);
          setHintsUsed(restore.hintsUsed);
          setReveals(restore.reveals);
          setWrongCount(restore.wrongCount);
          setMistakes(restore.mistakes);
          setDone(false);
          setShowFinal(false);
          setPraise(null);
          firstInputRef.current = restore.firstInputSec;
          resetTime(restore.activeMs);
          setResumed(true);
          if (restore.draft) setTimeout(() => fieldRef.current?.setValue(restore!.draft), 80);
          setTimeout(() => fieldRef.current?.focus({ keyboard: false }), 140);
          return;
        }
      }

      setEx(exercise);
      setHistory([]);
      setResult(null);
      setHintLevel(0);
      setHintsUsed(0);
      setCalcUses(0);
      setReveals(0);
      setWrongCount(0);
      setMistakes([]);
      setDone(false);
      setShowFinal(false);
      setPraise(null);
      setResumed(false);
      firstInputRef.current = null;
      resetTime(0);
      fieldRef.current?.clear();
      // תרגיל חדש נפתח בלי מקלדת – שנגה תראה אותו במלואו; המקלדת נפתחת כשהיא נוגעת בשדה
      setTimeout(() => fieldRef.current?.focus({ keyboard: false }), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeId, isCustom, reviveCustom, resetTime]
  );

  /** כניסה ראשונה לנושא: פותחים את השיטה לפני התרגיל הראשון, פעם אחת */
  const methodSeenKey = `mg_method_seen_${topicId}`;
  const [methodSeen, setMethodSeen] = useState(true); // מניחים "כבר נראה" עד שקראנו – שלא יקפוץ לרגע
  useEffect(() => {
    try {
      setMethodSeen(localStorage.getItem(methodSeenKey) === "1");
    } catch {
      setMethodSeen(true);
    }
  }, [methodSeenKey]);
  const markMethodSeen = useCallback(() => {
    try {
      localStorage.setItem(methodSeenKey, "1");
    } catch {
      /* ignore */
    }
    setMethodSeen(true);
  }, [methodSeenKey]);
  const pushMethod = shouldPushMethod({ summary, topicId, isCustom, alreadySeen: methodSeen });

  /** כשהמקלדת נפתחת היא מכסה את החלק התחתון – גוללים כדי שהתרגיל יישאר מול העיניים */
  useEffect(() => {
    const root = document.documentElement;
    const keepVisible = () => {
      if (!root.classList.contains("kb-open")) return;
      requestAnimationFrame(() => {
        const anchor = liveEndRef.current;
        const dock = document.querySelector(".input-bar");
        if (!anchor || !dock) return;
        const overlap = anchor.getBoundingClientRect().bottom - dock.getBoundingClientRect().top;
        if (overlap > 0) window.scrollBy({ top: overlap + 12, behavior: "smooth" });
      });
    };
    const obs = new MutationObserver(keepVisible);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  /** מתחילים: אם יש תרגיל שנקטע – ממשיכים ממנו; אחרת תרגיל חדש ברמה המתאימה */
  const start = useCallback(
    (fallbackLevel: number) => {
      const rec = loadResume(typeId);
      const freshSession = rec ? Date.now() - rec.savedAt <= SESSION_MAX_AGE_MS : false;
      if (rec && freshSession) {
        setSessionCount(rec.sessionCount);
        setSessionWrong(rec.sessionWrong);
        setCleanRun(rec.cleanRun);
      }
      if (rec && !rec.finished && (rec.history.length || rec.draft || rec.hintsUsed || rec.wrongCount)) {
        setLevel(rec.level);
        newExercise(rec.level, rec);
        return;
      }
      setLevel(fallbackLevel);
      newExercise(fallbackLevel);
    },
    [typeId, newExercise]
  );

  // initial level from progress (or fallback after 1.5s)
  useEffect(() => {
    if (!summary || levelInit.current) return;
    levelInit.current = true;
    const tp = summary.types[typeId];
    let lv = tp?.lastLevel ?? 1;
    if (tp && tp.mastery > 0.8 && lv < 3) lv++;
    start(lv);
  }, [summary, typeId, start]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!levelInit.current) {
        levelInit.current = true;
        start(1);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [start]);

  /* ---------- שמירת מקום: ממשיכים בדיוק מאיפה שעצרנו ---------- */
  const draftDirty = useRef(false);
  const persistRef = useRef<() => void>(() => {});
  const persist = useCallback(() => {
    if (!ex) return;
    let draft = "";
    try {
      draft = fieldRef.current?.getValue() ?? "";
    } catch {
      draft = "";
    }
    saveResume({
      typeId,
      topicId: ex.topicId,
      title: typeInfo?.title,
      level,
      seed: seedRef.current,
      customEx: isCustom ? customRawRef.current ?? undefined : undefined,
      promptLatex: ex.promptLatex,
      history,
      draft,
      hintLevel,
      hintsUsed,
      reveals,
      wrongCount,
      mistakes,
      activeMs: activeMs(),
      firstInputSec: firstInputRef.current,
      sessionCount,
      sessionWrong,
      cleanRun,
      calcUses,
      finished: done,
    });
  }, [ex, typeId, typeInfo, level, isCustom, history, hintLevel, hintsUsed, reveals, wrongCount, mistakes, sessionCount, sessionWrong, cleanRun, calcUses, done, activeMs]);
  persistRef.current = persist;
  useEffect(() => {
    persist();
  }, [persist]);

  // עצירת מד-הזמן ושמירה כשהאפליקציה עוברת לרקע (יציאה לוואטסאפ, סגירת מסך)
  useEffect(() => {
    const pause = () => {
      const t = timeRef.current;
      if (!t.hidden) {
        t.acc += Date.now() - t.since;
        t.hidden = true;
      }
    };
    const resume = () => {
      const t = timeRef.current;
      if (t.hidden) {
        t.since = Date.now();
        t.hidden = false;
      }
    };
    const onVis = () => {
      if (document.hidden) {
        pause();
        persistRef.current();
      } else resume();
    };
    const onHide = () => {
      pause();
      persistRef.current();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    // גם תוך כדי הקלדה – כדי שהשורה שהיא באמצע כתיבתה לא תיעלם
    const iv = setInterval(() => {
      if (draftDirty.current) {
        draftDirty.current = false;
        persistRef.current();
      }
    }, 4000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      clearInterval(iv);
    };
  }, []);

  const currentStage = useMemo(() => {
    if (!ex) return 0;
    if (!history.length) return 0;
    // stage of the last accepted line
    return result?.stage ?? 0;
  }, [ex, history, result]);

  const stageInfo = ex?.stages[Math.min(currentStage, ex.stages.length - 1)];
  /** האותיות של התרגיל – המקלדת נבנית סביבן (למשל תרגיל עם m ו-n) */
  const kbVars = useMemo(() => (ex ? exerciseVariables(ex) : []), [ex]);

  function finish(exercise: Exercise, hist: string[], extraReveal = 0) {
    const dur = Math.round(activeMs() / 1000);
    const rev = reveals + extraReveal;
    const correct = true;
    const gain = xpFor({ correct, hints: hintsUsed, reveals: rev, level: exercise.level });
    setXpGain(gain);
    setDone(true);
    setSessionCount((c) => c + 1);
    setSessionWrong((w) => w + wrongCount);
    const clean = hintsUsed === 0 && rev === 0 && wrongCount === 0;
    const nextClean = clean ? cleanRun + 1 : 0;
    setCleanRun(nextClean);
    setLevelNote(null);
    // ---- הקול: מדרג מחמאות + שכבה 2 ----
    const struggled = wrongCount >= 2 || hintsUsed >= 2;
    const hard = exercise.level >= 3 || struggled;
    const milestone = nextClean === 5 || (nextClean >= 3 && exercise.level === 3);
    if (rev) setPraise({ head: "סיימנו. בפעם הבאה בלי הצגת צעד.", tier: "normal" });
    else if (milestone) setPraise({ head: rot.current.pick("m", PRAISE_MILESTONE), sub: nextClean === 5 ? "חמישה ברצף, בלי רמז אחד." : "שלושה ברצף ברמה הכי גבוהה.", tier: "milestone" });
    else if (hard) setPraise({ head: rot.current.pick("h", PRAISE_HARD), sub: struggled ? rot.current.pick("s", AFTER_STRUGGLE)(wrongCount) : undefined, tier: "hard" });
    else setPraise({ head: rot.current.pick("n", PRAISE_NORMAL), tier: "normal" });
    if ((sessionCount + 1) % 8 === 0) setShowSummary(true);
    logAttempt({
      first_input_sec: firstInputRef.current === null ? null : Math.min(3600, firstInputRef.current),
      skipped: false,
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
      calc_uses: calcUses,
    }).then(reload);
    // adaptive level – עולים אחרי 3 תרגילים נקיים ברצף (בלי רמז, בלי הצגת צעד, בלי טעות)
    if (nextClean >= 3 && level < 3) {
      setLevel(level + 1);
      setCleanRun(0);
      setLevelNote({ kind: "up", text: `שלושה נקיים ברצף – עלית לרמה ${level + 1}. התרגיל הבא כבר ברמה החדשה.` });
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
      if (res.warn && res.mistake) setMistakes((m) => [...m, res.mistake!]);
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
    // level down if struggled a lot – 4 טעויות ומעלה בתרגיל אחד ⇒ הבא רמה אחת למטה
    let lv = level;
    const wentUp = levelNote?.kind === "up";
    setLevelNote(null);
    if (wrongCount >= 4 && lv > 1) {
      lv--;
      setLevelNote({ kind: "down", text: `${wrongCount} טעויות בתרגיל הקודם – ירדנו לרמה ${lv} כדי לחזק. שלושה נקיים ברצף ומטפסים חזרה.` });
    } else if (wentUp) {
      setLevelNote({ kind: "up", text: `רמה ${lv} – זו הרמה החדשה. תרגיל נקי = בלי רמז, בלי הצגת צעד, בלי טעות.` });
    }
    setLevel(lv);
    newExercise(lv);
  }

  if (!topic || !typeInfo) return <main className="p-6">סוג תרגיל לא נמצא</main>;

  return (
    <>
      <TopBar tester={profile === "tester"} summary={summary} back={isCustom ? "/photo" : `/learn/${topicId}`} title={typeInfo.title} />
      <main className="max-w-3xl mx-auto w-full p-4 pb-40 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            className="chip transition hover:bg-primary-tint"
            onClick={() => setShowLevelInfo(true)}
            title="איך עולים ויורדים רמה?"
            aria-label="הסבר על הרמות"
          >
            רמה {"⭐".repeat(level)}
            {level < 3 && <LevelRing cleanRun={cleanRun} />}
            {level >= 3 && <span className="mr-1 text-lime-ink text-xs">מקס</span>}
            <span className="mr-1 text-muted">ⓘ</span>
          </button>
          <span className="chip">היום בסשן: {sessionCount}</span>
          {stageInfo && !done && <span className="chip bg-primary-tint text-primary-ink border-primary-tint truncate">שלב: <Txt s={stageInfo.name} /></span>}
        </div>

        {levelNote && !done && (
          <div className={`rounded-2xl px-3 py-2 text-sm flex items-start gap-2 animate-pop ${levelNote.kind === "up" ? "bg-lime-tint text-lime-ink border border-lime-deep/40" : "bg-primary-tint text-primary-ink border border-primary/25"}`}>
            <span className="font-black">{levelNote.kind === "up" ? "↑" : "↓"}</span>
            <span className="flex-1">{levelNote.text}</span>
            <button className="text-xs opacity-60 hover:opacity-100" onClick={() => setLevelNote(null)} aria-label="סגור">✕</button>
          </div>
        )}
        {!done && ex && level < 3 && (hintsUsed > 0 || reveals > 0 || wrongCount > 0) && (
          <div className="text-xs text-muted -mt-1">התרגיל הזה כבר לא נחשב &quot;נקי&quot; ({hintsUsed > 0 ? "רמז" : reveals > 0 ? "הצגת צעד" : "טעות"}) – הרצף לרמה הבאה מתחיל מחדש בתרגיל הבא. זה בסדר, ככה לומדים.</div>
        )}

        {showLevelInfo && (
          <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setShowLevelInfo(false)}>
            <div className="bg-white rounded-[28px] p-4 max-w-md w-full space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="איך עולים רמה">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">איך עולים ויורדים רמה?</h3>
                <button className="btn-ghost text-sm" onClick={() => setShowLevelInfo(false)}>סגור</button>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>
                  יש 3 רמות קושי לכל סוג תרגיל: <b>⭐ ⭐⭐ ⭐⭐⭐</b>. את עכשיו ברמה <b>{level}</b>{level < 3 ? ` – ${cleanRun} מתוך 3 נקיים ברצף.` : " – הרמה הכי גבוהה."}
                </p>
                <div className="rounded-2xl bg-lime-tint border border-lime-deep/40 p-3">
                  <div className="font-semibold text-lime-ink">↑ עולים רמה</div>
                  <div className="text-lime-ink/90">
                    <b>שלושה תרגילים &quot;נקיים&quot; ברצף</b>. נקי = פתרת נכון <b>בלי רמז, בלי &quot;הצג את הצעד&quot;, ובלי אף שורה אדומה</b>. הטבעת ליד הרמה מתמלאת עם הרצף.
                  </div>
                </div>
                <div className="rounded-2xl bg-primary-tint border border-primary/25 p-3">
                  <div className="font-semibold text-primary-ink">↓ יורדים רמה</div>
                  <div className="text-primary-ink/90">
                    רק בשני מקרים: <b>4 טעויות (שורות אדומות) או יותר בתרגיל אחד</b> – התרגיל הבא יהיה רמה אחת למטה. או אם <b>דילגת</b> על תרגיל. רמז או טעות אחת לא מורידים רמה – הם רק מאפסים את הרצף.
                  </div>
                </div>
                <div className="rounded-2xl bg-warn-tint border border-warn/40 p-3">
                  <div className="font-semibold text-warn-ink">מאיפה מתחילים</div>
                  <div className="text-warn-ink/90">כשנכנסים לתרגול מתחילים ברמה שבה סיימת בפעם הקודמת. ואם השליטה שלך בנושא גבוהה (מעל 80% בתרגילים האחרונים) – מתחילים רמה אחת גבוה יותר.</div>
                </div>
                <p className="text-ink-soft">
                  הרמה לא ציון – היא רק קובעת כמה קשה התרגיל הבא. רמה גבוהה = יותר נקודות ⭐ לכל תרגיל ({"10/20/30"} לרמות 1/2/3), פחות אם השתמשת ברמזים.
                </p>
              </div>
            </div>
          </div>
        )}

        {ex && (
          <div className={`card ${done ? "!bg-lime-tint/80 !border-lime-deep/50" : ""}`}>
            <div className="text-ink-soft text-sm mb-1"><Txt s={ex.instruction} /></div>
            <div className="text-2xl sm:text-3xl py-2">
              <M latex={ex.promptLatex} block />
            </div>
            {ex.kind === "geo" && (
              <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start mt-1">
                {ex.asks && ex.asks.length > 0 && (
                  <ul className="text-sm space-y-1" aria-label="מה מחפשים">
                    {geoChecklist(ex, history).map((c) => (
                      <li key={c.key} className={`flex items-start gap-2 ${c.done ? "text-lime-ink" : "text-ink-soft"}`}>
                        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${c.done ? "bg-lime text-lime-ink" : "border border-line text-transparent"}`}>✓</span>
                        <span className={c.done ? "line-through opacity-70" : ""}><Txt s={c.label} /></span>
                      </li>
                    ))}
                  </ul>
                )}
                {ex.plot && <CoordPlot spec={ex.plot} size={200} />}
              </div>
            )}
          </div>
        )}

        {resumed && !done && (
          <div className="rounded-2xl bg-primary-tint border border-primary/25 p-2 text-sm text-primary-ink flex items-center gap-2">
            <span>↩ המשכנו מאיפה שעצרת – מה שכתבת שמור.</span>
            <button
              className="btn-ghost text-xs mr-auto"
              onClick={() => {
                clearResume(typeId);
                newExercise(level);
              }}
            >
              תרגיל אחר
            </button>
          </div>
        )}

        {/* accepted lines */}
        {history.length > 0 && (
          <div className="card space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 animate-pop">
                <span className="w-5 h-5 rounded-full bg-lime text-lime-ink flex items-center justify-center text-xs font-black shrink-0">✓</span>
                <div className="text-xl flex-1">
                  <M latex={h.replace(/כל x/g, "\\text{כל } x").replace(/אין פתרון/g, "\\text{אין פתרון}")} block />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* feedback */}
        <div ref={liveEndRef} aria-hidden />
        {result && !done && (
          <div key={shake} className={`rounded-2xl p-3 text-sm leading-relaxed ${result.warn ? "bg-warn-tint text-warn-ink border border-warn/40" : result.status === "ok" ? "bg-lime-tint text-lime-ink" : result.status === "wrong" || result.status === "unparsable" ? "bg-error-tint text-error-ink animate-shake" : "bg-white/70 text-ink-soft"}`}>
            <Txt s={result.status === "ok" && !result.message.startsWith("👀") ? `✓ ${result.message}` : result.message} />
            {result.warn && (
              <div className="mt-1 font-medium">
                ⚠ <Txt s={result.warn} />
              </div>
            )}
          </div>
        )}

        {/* hints */}
        {!done && ex && (
          <div className="space-y-2">
            {hintLevel >= 1 && stageInfo && (
              <div className="rounded-2xl p-3 bg-primary-tint/70 text-primary-ink animate-pop">
                <b><Txt s={stageInfo.name} />:</b> <RichText text={stageInfo.hint1} />
              </div>
            )}
            {hintLevel >= 2 && stageInfo && (
              <div className="rounded-2xl p-3 bg-primary-tint text-primary-ink border border-primary/25 animate-pop">
                <RichText text={stageInfo.hint2} />
              </div>
            )}
          </div>
        )}

        {/* done */}
        {done && ex && (
          <div className="card !bg-gradient-to-br !from-lime-tint !to-white !border-lime-deep/50 animate-pop space-y-3">
            <div className={`font-black flex items-center gap-2 ${praise?.tier === "milestone" ? "text-3xl text-topic-pink-ink" : praise?.tier === "hard" ? "text-2xl text-lime-ink" : "text-xl text-lime-ink"}`}>
              <span className="w-8 h-8 rounded-full bg-lime text-lime-ink flex items-center justify-center text-lg shrink-0">✓</span>
              {praise?.head ?? "נכון."}
            </div>
            {praise?.sub && <div className="text-ink-soft text-sm leading-relaxed">{praise.sub}</div>}
            {levelNote?.kind === "up" && (
              <div className="rounded-2xl bg-lime-tint border border-lime-deep/50 px-3 py-2 text-lime-ink font-semibold animate-pop">↑ {levelNote.text}</div>
            )}
            {!levelNote && level < 3 && (
              <div className="text-xs text-muted flex items-center gap-1.5">
                <LevelRing cleanRun={cleanRun} size={16} />
                <span>
                  רצף נקי לרמה הבאה: {cleanRun}/3
                  {cleanRun === 0 && (hintsUsed > 0 || reveals > 0 || wrongCount > 0) ? " – התחיל מחדש (היה רמז/טעות). התרגיל הבא נקי – וזה 1." : cleanRun > 0 ? ` – עוד ${3 - cleanRun} ועולים.` : ""}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="chip !bg-lime !text-lime-ink !border-lime text-base">+{xpGain} ⭐</span>
              {wrongCount > 0 && !praise?.sub && <span className="text-sm text-muted">({wrongCount} {wrongCount === 1 ? "ניסיון" : "ניסיונות"} בדרך – זה חלק מהעניין)</span>}
            </div>
            {showSummary && (
              <div className="rounded-2xl bg-white/70 border border-lime-deep/40 p-2 text-sm text-ink-soft">
                {sessionSummary(sessionCount, sessionWrong)}
                <button className="btn-ghost text-xs mr-2" onClick={() => setShowSummary(false)}>סגור</button>
              </div>
            )}
            <div className="text-sm text-ink-soft">
              תשובה סופית: <M latex={ex.finalLatex} />
              {ex.kind === "equation" && Array.isArray(ex.solutions) && " – כדאי להציב חזרה במקור ולבדוק."}
            </div>
            <div className="flex gap-2">
              {isCustom ? (
                <Link href="/photo" className="btn-primary flex-1 text-lg text-center" autoFocus>
                  לצלם עוד ←
                </Link>
              ) : (
                <button className="btn-primary flex-1 text-lg" onClick={next} autoFocus>
                  עוד תרגיל ←
                </button>
              )}
              <Link href={isCustom ? "/learn" : `/learn/${topicId}`} className="btn-soft">
                {isCustom ? "למפה" : "לנושא"}
              </Link>
            </div>
          </div>
        )}

        {/* input area – fixed bottom */}
        {!done && ex && (
          <div className="input-bar dock fixed bottom-0 inset-x-0 p-3 z-10">
            <div className="max-w-3xl mx-auto space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MathField
                    ref={fieldRef}
                    variables={kbVars}
                    placeholder="השורה הבאה…"
                    onEnter={submit}
                    keyboardHostId="kb-host"
                    onChange={() => {
                      if (firstInputRef.current === null) firstInputRef.current = Math.round(activeMs() / 1000);
                      draftDirty.current = true;
                    }}
                  />
                </div>
                <button className="btn-primary h-[58px] px-5 text-lg" onClick={submit}>
                  בדוק
                </button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button className="btn-soft text-sm" onClick={askHint} disabled={hintLevel >= 2}>
                  {hintLevel === 0 ? "רמז" : hintLevel === 1 ? "רמז חזק" : "אין עוד רמזים"}
                </button>
                <button className="btn-soft text-sm" onClick={revealStep} disabled={hintLevel < 2}>
                  הצג את הצעד
                </button>
                {!isCustom && <MethodSheet topicId={topicId} push={pushMethod} onPushShown={markMethodSeen} />}
                <FormulaSheet />
                <Calculator onUse={() => setCalcUses((c) => c + 1)} onInsert={(t) => fieldRef.current?.insert?.(t)} />
                {ex.kind === "fracdomain" && (
                  <button className="btn-ghost text-sm" onClick={() => fieldRef.current?.insert?.("x\\ne")} title="תחום הצבה">
                    x≠
                  </button>
                )}
                {ex.kind === "geo" && (
                  <button className="btn-ghost text-sm" onClick={() => fieldRef.current?.insert?.("\\left(#?,#?\\right)")} title="נקודה (x, y)">
                    ( , )
                  </button>
                )}
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
                <button className="btn-ghost text-sm mr-auto !text-faint" onClick={() => setShowFinal((s) => !s)} title="דלגי על התרגיל">
                  דלג
                </button>
              </div>
              {showFinal && (
                <div className="text-sm text-ink-soft flex items-center gap-2">
                  <span>לדלג? התרגיל יירשם כלא-פתור.</span>
                  <button
                    className="btn-soft text-xs"
                    onClick={() => {
                      logAttempt({ type_id: ex.typeId, topic_id: ex.topicId, level: ex.level, correct: false, hints: hintsUsed, reveals, wrong_lines: wrongCount, duration_sec: Math.min(Math.round(activeMs() / 1000), 3600), lines: history, prompt: ex.promptLatex.slice(0, 500), mistakes: [...mistakes, "final"], skipped: true, calc_uses: calcUses, first_input_sec: firstInputRef.current === null ? null : Math.min(3600, firstInputRef.current) }).then(reload);
                      setSessionWrong((w) => w + wrongCount);
                      const lv = level > 1 ? level - 1 : 1;
                      setLevelNote(lv < level ? { kind: "down", text: `דילגת – ירדנו לרמה ${lv}. שלושה נקיים ברצף ומטפסים חזרה.` } : null);
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
