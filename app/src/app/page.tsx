"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import InstallHint from "@/components/InstallHint";

export default function Home() {
  const router = useRouter();
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(profile: "noga" | "parent" | "tester") {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, pin }) });
    setBusy(false);
    if (r.ok) router.push(profile === "parent" ? "/parent" : "/learn");
    else setErr("קוד שגוי, נסה שוב");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <div className="mx-auto mb-3 w-20 h-20 rounded-[24px] flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" }} aria-hidden>
          <svg width="40" height="40" viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="15" x2="16" y2="3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="9" cy="9" r="2.6" fill="#fff" />
          </svg>
        </div>
        <h1 className="text-3xl font-black">מכוונים גבוה</h1>
        <p className="text-ink-soft mt-2 font-medium">אבא בנה לך את זה. השיטה כאן היא השיטה שלו.</p>
        <p className="text-muted text-sm mt-1">חתולים, מגנטים, ועד בית קומוניסטי – וגולאג</p>
      </div>
      <div className="grid gap-4 w-full max-w-sm">
        <button onClick={() => login("noga")} disabled={busy} className="card text-right hover:shadow-md transition flex items-center gap-4 hover:!border-primary/40">
          <span className="w-14 h-14 rounded-2xl bg-primary-tint text-primary-ink flex items-center justify-center text-2xl font-black shrink-0">נ</span>
          <div>
            <div className="text-2xl font-bold">נגה</div>
            <div className="text-muted">בואי נתרגל</div>
          </div>
        </button>
        {!pinMode ? (
          <button onClick={() => setPinMode(true)} className="card text-right hover:shadow-md transition flex items-center gap-4 hover:!border-primary/40">
            <span className="w-14 h-14 rounded-2xl bg-topic-green text-topic-green-ink flex items-center justify-center text-2xl font-black shrink-0">א</span>
            <div>
              <div className="text-2xl font-bold">אבא</div>
              <div className="text-muted">מסך מעקב (קוד)</div>
            </div>
          </button>
        ) : (
          <form
            className="card flex flex-col gap-3 !border-primary/30"
            onSubmit={(e) => {
              e.preventDefault();
              login("parent");
            }}
          >
            <label className="font-bold">קוד הורה</label>
            <input
              autoFocus
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="border border-line rounded-2xl p-3 text-2xl tracking-widest text-center ltr bg-white"
              maxLength={24}
            />
            {err && <div className="text-error-ink text-sm">{err}</div>}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy}>
                מסך הורה
              </button>
              <button type="button" className="btn-soft flex-1" disabled={busy} onClick={() => login("tester")} title="לנסות את האפליקציה כמו נגה – בלי שיירשם">
                🧪 לבדוק את האפליקציה
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPinMode(false)}>
                ביטול
              </button>
            </div>
            <div className="text-xs text-muted">"לבדוק את האפליקציה" נכנס למסכים של נגה עם הקוד שלך – ושום תרגיל לא נרשם לה.</div>
          </form>
        )}
        <InstallHint />
      </div>
    </main>
  );
}
