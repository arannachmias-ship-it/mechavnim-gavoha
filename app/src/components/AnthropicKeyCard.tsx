"use client";
import { useEffect, useState } from "react";

type Status = { hasKey: boolean; last4?: string; updatedAt?: string };

/** מסך הורה – שדה למפתח ה-API של אנתרופיק (נשמר מוצפן, מוצג רק ב-4 תווים אחרונים) */
export default function AnthropicKeyCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch("/api/admin/anthropic", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSt(j.ok ? j : { hasKey: false }))
      .catch(() => setSt({ hasKey: false }));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/anthropic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const j = await r.json().catch(() => ({ ok: false, error: "שגיאה" }));
    setBusy(false);
    if (j.ok) {
      setKey("");
      setMsg({ ok: true, text: "המפתח אומת מול אנתרופיק ונשמר מוצפן." });
      setSt(j);
    } else setMsg({ ok: false, text: j.error ?? "לא הצליח." });
  }

  async function remove() {
    if (!confirm("למחוק את המפתח השמור?")) return;
    setBusy(true);
    await fetch("/api/admin/anthropic", { method: "DELETE" });
    setBusy(false);
    setMsg({ ok: true, text: "המפתח נמחק." });
    load();
  }

  return (
    <section className="card">
      <h2 className="font-bold mb-1">🔑 מפתח API של אנתרופיק</h2>
      <div className="text-xs text-slate-500 mb-3">
        בשביל פיצ'ר הצילום. המפתח נשמר <b>מוצפן</b> בבסיס הנתונים, אף פעם לא מוצג שוב במלואו, ונשלח רק מהשרת לאנתרופיק. אפשר להחליף או למחוק בכל רגע.
      </div>
      {st === null ? (
        <div className="text-slate-500 text-sm">טוען…</div>
      ) : (
        <>
          <div className={`text-sm mb-3 rounded-xl px-3 py-2 ${st.hasKey ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            {st.hasKey ? (
              <>
                ✔ יש מפתח שמור (מסתיים ב-<span className="ltr inline-block font-mono">…{st.last4}</span>){st.updatedAt ? ` · עודכן ${new Date(st.updatedAt).toLocaleDateString("he-IL")}` : ""}
              </>
            ) : (
              "עדיין אין מפתח שמור."
            )}
          </div>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (key.trim()) save();
            }}
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={st.hasKey ? "להדביק מפתח חדש כדי להחליף (sk-ant-…)" : "להדביק כאן את המפתח (sk-ant-…)"}
              className="border rounded-xl p-3 flex-1 ltr font-mono text-sm"
              dir="ltr"
            />
            <button className="btn-primary" disabled={busy || key.trim().length < 20}>
              {busy ? "בודק…" : "אמת ושמור"}
            </button>
            {st.hasKey && (
              <button type="button" className="btn-ghost text-red-600 text-sm" disabled={busy} onClick={remove}>
                מחק
              </button>
            )}
          </form>
          {msg && <div className={`text-sm mt-2 ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</div>}
          <div className="text-[11px] text-slate-400 mt-2">
            איך מוציאים מפתח: console.anthropic.com → Settings → Billing (לטעון קרדיט, למשל 5$) → API Keys → Create Key. מומלץ גם לקבוע Spend limit חודשי שם.
          </div>
        </>
      )}
    </section>
  );
}
