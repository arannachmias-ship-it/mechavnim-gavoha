"use client";
import { useEffect, useState } from "react";
import type { InterviewRow } from "@/lib/db";
import { transcriptText } from "@/lib/interview";

/** 🎤 מסך הורה: יצירת לינק לראיון עם נגה, שיתוף בוואטסאפ, צפייה בתמלול ובממצאים, הורדה */
export default function InterviewCard() {
  const [items, setItems] = useState<InterviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [openTok, setOpenTok] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/interview/admin", { cache: "no-store" });
    if (r.ok) setItems((await r.json()).items ?? []);
    else setItems([]);
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkOf = (t: string) => `${origin}/interview/${t}`;

  const create = async () => {
    setBusy(true);
    const r = await fetch("/api/interview/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setBusy(false);
    if (r.ok) {
      const j = await r.json();
      await load();
      setOpenTok(j.item?.token ?? null);
    }
  };
  const remove = async (t: string) => {
    if (!confirm("למחוק את הראיון והתמלול? זה בלתי הפיך.")) return;
    await fetch(`/api/interview/admin?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    await load();
  };
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(t));
      setCopied(t);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("העתיקי את הלינק:", linkOf(t));
    }
  };
  const download = (iv: InterviewRow) => {
    const blob = new Blob([transcriptText(iv.title, iv.messages, iv.summary)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${iv.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const waText = (t: string) => encodeURIComponent(`נגה, זה הלינק לשיחה הקצרה על האפליקציה (בערך 15 דק', אפשר לדבר או להקליד): ${linkOf(t)}`);

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-bold flex-1">🎤 ראיון משתמש עם נגה</h2>
        <button className="btn-primary text-sm" onClick={create} disabled={busy}>
          + לינק לראיון חדש
        </button>
      </div>
      <div className="text-xs text-slate-500">
        Claude מראיין את נגה כחוקר/ת UX (עיצוב + חוויית הלמידה, ~15 דק&apos;). היא מדברת – הדפדפן מתמלל (כרום/ספארי בטלפון) – או מקלידה. נשמר תמלול בלבד, בלי קול. בסוף נכתבים &quot;ממצאים&quot; לתקציר העיצוב. הלינק הוא הסוד: מי שיש לו יכול לענות – שלח אותו רק לה.
      </div>
      {items === null && <div className="text-slate-500 text-sm">טוען…</div>}
      {items && items.length === 0 && <div className="text-slate-500 text-sm">עוד אין ראיונות. לחץ על &quot;לינק לראיון חדש&quot;, ושלח לנגה.</div>}
      {items?.map((iv) => {
        const open = openTok === iv.token;
        const turns = iv.messages.filter((m) => m.role === "user").length;
        return (
          <div key={iv.token} className={`rounded-xl border p-3 space-y-2 ${iv.status === "done" ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold flex-1 min-w-0 truncate">{iv.title}</div>
              <span className={`chip text-xs ${iv.status === "done" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{iv.status === "done" ? "הסתיים" : turns ? `בתהליך · ${turns} תשובות` : "עוד לא התחיל"}</span>
              <button className="btn-ghost text-xs" onClick={() => setOpenTok(open ? null : iv.token)}>
                {open ? "סגור" : "פרטים"}
              </button>
            </div>
            {open && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap items-center text-sm">
                  <code className="text-xs bg-white border rounded px-2 py-1 max-w-full truncate ltr" dir="ltr">
                    {linkOf(iv.token)}
                  </code>
                  <button className="btn-soft text-xs" onClick={() => copy(iv.token)}>
                    {copied === iv.token ? "הועתק ✔" : "העתק"}
                  </button>
                  <a className="btn-soft text-xs" href={`https://wa.me/?text=${waText(iv.token)}`} target="_blank" rel="noreferrer">
                    שלח בוואטסאפ
                  </a>
                  {iv.messages.length > 0 && (
                    <button className="btn-soft text-xs" onClick={() => download(iv)}>
                      הורד תמלול (.md)
                    </button>
                  )}
                  <button className="btn-ghost text-xs text-red-600 mr-auto" onClick={() => remove(iv.token)}>
                    מחק
                  </button>
                </div>
                {iv.summary && (
                  <div className="rounded-xl bg-white border border-emerald-200 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                    <div className="font-bold text-emerald-800 mb-1">📋 ממצאים</div>
                    {iv.summary}
                  </div>
                )}
                {iv.messages.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-600">תמלול מלא ({iv.messages.length} הודעות)</summary>
                    <div className="mt-2 space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {iv.messages.map((m, i) => (
                        <div key={i} className={`rounded-lg px-3 py-1.5 ${m.role === "assistant" ? "bg-slate-50" : "bg-amber-50 font-medium"}`}>
                          <span className="text-xs text-slate-400 ml-1">{m.role === "assistant" ? "המראיינת:" : "נגה:"}</span> {m.text}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
