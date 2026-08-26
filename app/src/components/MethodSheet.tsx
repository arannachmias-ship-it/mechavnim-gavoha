"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOPIC_BY_ID } from "@/content/topics";
import { Math as M, RichText, Txt } from "@/components/MathText";

/**
 * "השיטה" בתוך התרגול: כשנגה מגיעה ישר מהתוכנית לתרגיל, ההסבר, הדוגמה הפתורה
 * והסרטונים נמצאים במסך אחר – וקל לפספס שהם שם. זה אותו תוכן, בחלון צף,
 * בלי לצאת מהתרגיל ובלי לאבד את מה שכבר נכתב.
 */
export default function MethodSheet({ topicId, push = false, onPushShown }: { topicId: string; push?: boolean; onPushShown?: () => void }) {
  const topic = TOPIC_BY_ID[topicId];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"method" | "example" | "video">("method");
  const [exStep, setExStep] = useState(0);
  /** מצב "כניסה ראשונה": נפתח מעצמו, ויוצאים ממנו עם כפתור שמוביל לתרגיל */
  const [pushed, setPushed] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!push || shownRef.current) return;
    shownRef.current = true;
    setTab("method");
    setOpen(true);
    setPushed(true);
    onPushShown?.();
  }, [push, onPushShown]);

  /** סוגרים – ויוצאים ממצב "כניסה ראשונה", כדי שפתיחה ידנית אחר-כך תיראה רגילה */
  const close = useCallback(() => {
    setOpen(false);
    setPushed(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!topic) return null;

  return (
    <>
      <button className="btn-soft text-sm" onClick={() => setOpen(true)} title="ההסבר, הדוגמה והסרטון של הנושא">
        השיטה
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
            <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 p-3 border-b border-line">
                <div className="flex-1 min-w-0">
                  {pushed && <div className="text-xs text-primary-ink font-semibold">פעם ראשונה בנושא הזה – ככה זה עובד</div>}
                  <div className="font-bold truncate">
                    <Txt s={topic.title} />
                  </div>
                </div>
                <button className="btn-ghost px-2" onClick={close} aria-label="סגור">
                  ✕
                </button>
              </div>

              <div className="flex gap-2 px-3 pt-3">
                {(
                  [
                    ["method", "השיטה"],
                    ["example", "דוגמה"],
                    ["video", "סרטונים"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`chip flex-1 justify-center py-2 ${tab === k ? "!text-white !border-transparent" : ""}`}
                    style={tab === k ? { background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto p-3 space-y-3">
                {tab === "method" &&
                  topic.cards.map((c, i) => (
                    <section key={i} className="rounded-2xl bg-canvas/70 p-3">
                      <h3 className="font-bold mb-1">
                        <RichText text={c.title} />
                      </h3>
                      <div className="space-y-2 leading-relaxed text-sm">
                        {c.body.map((p, j) => (
                          <p key={j}>
                            <RichText text={p} />
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}

                {tab === "example" && (
                  <div className="space-y-3">
                    <div className="text-muted text-xs">דוגמה פתורה – זה תרגיל אחר, לא זה שאת פותרת עכשיו.</div>
                    <div className="text-xl bg-primary-tint/50 rounded-2xl p-3">
                      <M latex={topic.example.prompt} block />
                    </div>
                    <div className="space-y-2">
                      {topic.example.steps.slice(0, exStep).map((s, i) => (
                        <div key={i} className="animate-pop border-r-4 border-primary/40 pr-3">
                          <div className="text-lg">
                            <M latex={s.latex} block />
                          </div>
                          <div className="text-sm text-ink-soft">
                            <RichText text={s.note} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-sm"
                        onClick={() => setExStep((s) => Math.min(topic.example.steps.length, s + 1))}
                        disabled={exStep >= topic.example.steps.length}
                      >
                        הבא ←
                      </button>
                      <button className="btn-soft text-sm" onClick={() => setExStep(0)}>
                        מהתחלה
                      </button>
                    </div>
                  </div>
                )}

                {tab === "video" && (
                  <div className="space-y-3">
                    {topic.videoIds.length === 0 && <div className="text-muted text-sm">לנושא הזה עדיין אין סרטון של אבא – יש הסבר ודוגמה 🙂</div>}
                    {topic.videoIds.map((v) => (
                      <div key={v.id}>
                        <div className="aspect-video rounded-xl overflow-hidden bg-black">
                          <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${v.id}`}
                            title={v.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <div className="pt-1 text-sm font-semibold">{v.title}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pushed && (
                <div className="border-t border-line p-3 flex items-center gap-2">
                  <button className="btn-primary flex-1" onClick={close}>
                    קדימה לתרגיל ←
                  </button>
                  <div className="text-xs text-muted flex-1">אפשר לפתוח את זה שוב בכפתור ״השיטה״ בכל רגע.</div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
