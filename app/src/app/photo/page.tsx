"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProgress } from "@/lib/client";
import TopBar from "@/components/TopBar";
import { Math as M, RichText } from "@/components/MathText";
import type { Exercise } from "@/lib/math/types";

type Item = {
  latex: string;
  kind: string;
  task: string;
  note?: string;
  exercise?: Omit<Exercise, "stageOf">;
  unsupported?: string;
};

const KIND_LABEL: Record<string, string> = { expr: "ביטוי", equation: "משוואה", system: "מערכת משוואות", other: "אחר" };
const TASK_LABEL: Record<string, string> = { simplify: "פישוט", expand: "פתיחת סוגריים", factor: "פירוק לגורמים", solve: "פתרון", compute: "חישוב", other: "" };

/** מכווץ תמונה בצד הלקוח (עד 1400px, JPEG) – חוסך זמן וכסף */
async function compress(file: File): Promise<{ data: string; mediaType: string }> {
  const bmp = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale),
    h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

export default function PhotoPage() {
  const { summary, profile, error } = useProgress();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [explain, setExplain] = useState<Record<number, { text?: string; busy?: boolean; err?: string }>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error === "unauth") router.replace("/");
  }, [error, router]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    setItems(null);
    setExplain({});
    setPreview(URL.createObjectURL(f));
    setBusy(true);
    try {
      const { data, mediaType } = await compress(f);
      const r = await fetch("/api/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data, mediaType }) });
      const j = await r.json().catch(() => ({ ok: false, error: "שגיאה" }));
      if (!j.ok) setErr(j.error ?? "לא הצליח.");
      else if (!j.items?.length) setErr("לא זיהיתי תרגילים בתמונה. נסי לצלם קרוב יותר, ישר, ובאור טוב.");
      else setItems(j.items);
    } catch {
      setErr("לא הצלחתי לשלוח את התמונה. בדקי חיבור לאינטרנט.");
    } finally {
      setBusy(false);
    }
  }

  function practice(it: Item) {
    if (!it.exercise) return;
    sessionStorage.setItem("mg_custom_ex", JSON.stringify(it.exercise));
    router.push("/practice/custom");
  }

  async function askExplain(i: number, latex: string) {
    setExplain((e) => ({ ...e, [i]: { busy: true } }));
    const r = await fetch("/api/photo/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latex }) });
    const j = await r.json().catch(() => ({ ok: false }));
    setExplain((e) => ({ ...e, [i]: j.ok ? { text: j.text } : { err: j.error ?? "לא הצליח." } }));
  }

  return (
    <>
      <TopBar formulas tester={profile === "tester"} summary={summary} back="/learn" title="📷 צילום שאלה" />
      <main className="max-w-3xl mx-auto w-full p-4 pb-16 space-y-4">
        <section className="card border-2 border-amber-200 bg-amber-50 space-y-2">
          <div className="font-bold">מצלמים תרגיל מהדף – ומתרגלים אותו כאן, עם רמזים בשיטה של אבא.</div>
          <div className="text-sm text-slate-600">צלמי ישר, קרוב, באור טוב. עדיף תרגיל אחד או שניים בכל צילום. המחשב רק <b>קורא</b> את התמונה – את הבדיקה של הפתרון עושה המנוע הרגיל, שורה-שורה.</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary text-lg" disabled={busy} onClick={() => fileRef.current?.click()}>
              📷 {busy ? "קוראת…" : items ? "צלמי עוד" : "צלמי תרגיל"}
            </button>
            {preview && !busy && (
              <button className="btn-ghost text-sm" onClick={() => { setPreview(null); setItems(null); setErr(null); }}>
                נקה
              </button>
            )}
          </div>
        </section>

        {preview && (
          <section className="card">
            <img src={preview} alt="הצילום" className="max-h-64 mx-auto rounded-xl object-contain" />
            {busy && <div className="text-center text-slate-500 text-sm mt-2 animate-pulse">קוראת את התרגיל…</div>}
          </section>
        )}

        {err && <div className="rounded-xl bg-red-50 text-red-800 p-3 text-sm">{err}</div>}

        {items && (
          <section className="space-y-3">
            <div className="text-sm text-slate-600">זיהיתי {items.length} {items.length === 1 ? "תרגיל" : "תרגילים"}. בדקי שזה מה שכתוב בדף – אם לא, צלמי שוב.</div>
            {items.map((it, i) => (
              <div key={i} className={`card space-y-2 ${it.exercise ? "border-emerald-200" : "border-slate-200"}`}>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="chip bg-slate-100">{KIND_LABEL[it.kind] ?? it.kind}</span>
                  {TASK_LABEL[it.task] && <span className="chip bg-slate-100">{TASK_LABEL[it.task]}</span>}
                  {it.note && <span className="text-amber-700">· {it.note}</span>}
                </div>
                <div className="text-2xl py-1">
                  <M latex={it.latex} block />
                </div>
                {it.exercise ? (
                  <button className="btn-primary w-full" onClick={() => practice(it)}>
                    תרגלי את זה ←
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-600">🙈 את זה אני עוד לא יודעת ללוות שורה-שורה{it.unsupported ? ` (${it.unsupported})` : ""}.</div>
                    {!explain[i]?.text && (
                      <button className="btn-soft text-sm" disabled={explain[i]?.busy} onClick={() => askExplain(i, it.latex)}>
                        {explain[i]?.busy ? "מכינה הסבר…" : "🤖 הסבר בשיטה (AI – לא נבדק)"}
                      </button>
                    )}
                    {explain[i]?.err && <div className="text-red-700 text-sm">{explain[i].err}</div>}
                    {explain[i]?.text && (
                      <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-sm leading-relaxed space-y-2">
                        <div className="text-[11px] text-violet-700">🤖 הסבר שנכתב על ידי AI בשפה של אבא. הוא לא עבר את הבדיקה של המנוע – אם משהו נראה מוזר, תשאלי את אבא.</div>
                        {explain[i].text!.split(/\n+/).map((line, k) => (
                          <p key={k}>
                            <RichText text={line} />
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {!items && !busy && !preview && (
          <div className="text-center text-sm text-slate-500">
            אפשר גם להמשיך במסלול הרגיל – <Link href="/learn" className="underline">למפת הנושאים</Link>
          </div>
        )}
      </main>
    </>
  );
}
