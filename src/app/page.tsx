"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(profile: "noga" | "parent") {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, pin }) });
    setBusy(false);
    if (r.ok) router.push(profile === "noga" ? "/learn" : "/parent");
    else setErr("קוד שגוי, נסה שוב");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8 bg-gradient-to-b from-amber-50 to-white">
      <div className="text-center">
        <div className="text-6xl mb-2">🚀</div>
        <h1 className="text-3xl font-black">זינוק לבגרות</h1>
        <p className="text-slate-600 mt-1">מתמטיקה בשיטה של אבא – חתולים, מגנטים וגולאג</p>
      </div>
      <div className="grid gap-4 w-full max-w-sm">
        <button onClick={() => login("noga")} disabled={busy} className="card text-right hover:shadow-md transition flex items-center gap-4 border-2 border-pink-200 hover:border-pink-400">
          <span className="text-5xl">👩‍🎓</span>
          <div>
            <div className="text-2xl font-bold">נגה</div>
            <div className="text-slate-500">בואי נתרגל</div>
          </div>
        </button>
        {!pinMode ? (
          <button onClick={() => setPinMode(true)} className="card text-right hover:shadow-md transition flex items-center gap-4 border-2 border-sky-200 hover:border-sky-400">
            <span className="text-5xl">👨‍👧</span>
            <div>
              <div className="text-2xl font-bold">אבא</div>
              <div className="text-slate-500">מסך מעקב (קוד)</div>
            </div>
          </button>
        ) : (
          <form
            className="card flex flex-col gap-3 border-2 border-sky-300"
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
              className="border rounded-xl p-3 text-2xl tracking-widest text-center ltr"
              maxLength={24}
            />
            {err && <div className="text-red-600 text-sm">{err}</div>}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy}>
                כניסה
              </button>
              <button type="button" className="btn-soft" onClick={() => setPinMode(false)}>
                ביטול
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
