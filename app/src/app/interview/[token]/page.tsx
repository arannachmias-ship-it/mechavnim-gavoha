"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { role: "assistant" | "user"; text: string; at: string };

/* Web Speech API – טיפוסים מינימליים (אין ב-lib.dom בכל הגרסאות) */
interface SRResultLike { isFinal: boolean; 0: { transcript: string } }
interface SREventLike { resultIndex: number; results: ArrayLike<SRResultLike> }
interface SRLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SREventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
function getSR(): (new () => SRLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SRLike; webkitSpeechRecognition?: new () => SRLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * 🎤 ראיון משתמש – נגה מדברת (או מקלידה), Claude מראיין.
 * בלי כניסה: הלינק (עם הטוקן) הוא הסוד. התמלול נשמר בשרת אחרי כל תור.
 */
export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<"loading" | "open" | "done" | "missing" | "nokey">("loading");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const [err, setErr] = useState("");
  const recRef = useRef<SRLike | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const api = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/interview/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) setStatus("missing");
      else if (r.status === 503 && j.error === "no_key") setStatus("nokey");
      else if (!r.ok) setErr("משהו השתבש בדרך. נסי שוב עוד רגע.");
      return j as { ok?: boolean; messages?: Msg[]; done?: boolean; status?: string };
    },
    [token]
  );

  // load + first question
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/interview/${token}`).then((x) => x.json()).catch(() => null);
      if (!r || !r.ok) return setStatus("missing");
      if (r.status === "done") {
        setMsgs(r.messages ?? []);
        return setStatus("done");
      }
      if (r.messages?.length) {
        setMsgs(r.messages);
        setStatus("open");
        return;
      }
      setBusy(true);
      const s = await api({ action: "start" });
      setBusy(false);
      if (s.messages) {
        setMsgs(s.messages);
        setStatus(s.done ? "done" : "open");
      }
    })();
    const t = setTimeout(() => setSpeechOk(!!getSR()), 0);
    return () => clearTimeout(t);
  }, [token, api]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, interim, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    stopListening();
    setErr("");
    setDraft("");
    setInterim("");
    setMsgs((m) => [...m, { role: "user", text: t, at: new Date().toISOString() }]);
    setBusy(true);
    const r = await api({ action: "say", text: t });
    setBusy(false);
    if (r.messages) setMsgs(r.messages);
    if (r.done) setStatus("done");
  };

  const finish = async () => {
    if (busy) return;
    if (!confirm("לסיים את הראיון עכשיו?")) return;
    setBusy(true);
    const r = await api({ action: "finish" });
    setBusy(false);
    if (r.messages) setMsgs(r.messages);
    setStatus("done");
  };

  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };
  const startListening = () => {
    const SR = getSR();
    if (!SR) return setSpeechOk(false);
    setErr("");
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    let finalText = draft ? draft + " " : "";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
        else interimText += res[0].transcript;
      }
      setDraft(finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setErr("צריך לאשר גישה למיקרופון (או פשוט להקליד).");
      else if (e.error !== "aborted" && e.error !== "no-speech") setErr("לא הצלחתי לשמוע – נסי שוב או הקלידי.");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const last = msgs[msgs.length - 1];
  const qCount = msgs.filter((m) => m.role === "assistant").length;

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-white">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-amber-100 px-4 py-2 flex items-center gap-3">
        <span className="text-2xl">🎤</span>
        <div className="flex-1">
          <div className="font-bold leading-tight">שיחה קצרה על האפליקציה</div>
          <div className="text-xs text-slate-500">{status === "open" ? `שאלה ${qCount} · בערך 15 דקות · אין תשובות נכונות` : status === "done" ? "הראיון הסתיים – תודה!" : ""}</div>
        </div>
        {status === "open" && msgs.length > 2 && (
          <button className="btn-ghost text-xs" onClick={finish} disabled={busy}>
            לסיים
          </button>
        )}
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-3 pb-44">
        {status === "loading" && <div className="text-slate-500 text-center py-10">רגע…</div>}
        {status === "missing" && <div className="card text-center">הלינק הזה לא תקין או שהראיון נמחק. תבקשי מאבא לינק חדש 🙂</div>}
        {status === "nokey" && <div className="card text-center">הראיון עוד לא מוכן (חסר מפתח בהגדרות). תגידי לאבא.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${m.role === "assistant" ? "bg-white border border-amber-100 shadow-sm" : "bg-amber-500 text-white"}`}>{m.text}</div>
          </div>
        ))}
        {(interim || (listening && !draft)) && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-amber-100 text-amber-900 italic">{interim || "מקשיבה…"}</div>
          </div>
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-white border border-amber-100 text-slate-400 animate-pulse">…</div>
          </div>
        )}
        {status === "done" && (
          <div className="card border-2 border-emerald-200 bg-emerald-50 text-emerald-900 text-center space-y-1">
            <div className="text-2xl">💛</div>
            <div className="font-bold">זהו, סיימנו.</div>
            <div className="text-sm">מה שאמרת נשמר – ואבא ואני נשתמש בזה כדי לעצב את הגרסה הבאה. תודה שנתת מהזמן שלך.</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {status === "open" && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t p-3">
          <div className="max-w-2xl mx-auto space-y-2">
            {err && <div className="text-xs text-red-600">{err}</div>}
            <div className="flex items-end gap-2">
              {speechOk && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  disabled={busy}
                  className={`h-14 w-14 shrink-0 rounded-full text-2xl shadow transition active:scale-95 ${listening ? "bg-red-500 text-white animate-pulse" : "bg-amber-500 text-white"}`}
                  aria-label={listening ? "עצור הקלטה" : "דברי"}
                  title={listening ? "עצור" : "דברי – אני מתמללת"}
                >
                  {listening ? "■" : "🎤"}
                </button>
              )}
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={2}
                placeholder={speechOk ? "לחצי על המיקרופון ודברי, או הקלידי כאן…" : "הקלידי כאן…"}
                className="flex-1 rounded-2xl border-2 border-slate-200 focus:border-amber-400 focus:outline-none p-3 text-base resize-none"
                disabled={busy || !!last && last.role === "user"}
              />
              <button className="btn-primary h-14 px-4" onClick={() => send(draft)} disabled={busy || !draft.trim()}>
                שלחי
              </button>
            </div>
            <div className="text-[11px] text-slate-400 text-center">{speechOk ? "הדפדפן מתמלל את מה שאת אומרת; אפשר לתקן לפני ששולחים. נשמר רק הטקסט, לא הקול." : "בדפדפן הזה אין תמלול קולי – אפשר להקליד, או לפתוח בכרום/ספארי."}</div>
          </div>
        </div>
      )}
    </main>
  );
}
