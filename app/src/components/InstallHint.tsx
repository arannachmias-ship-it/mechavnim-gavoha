"use client";
import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** הצעה עדינה להתקין את האפליקציה למסך הבית (אנדרואיד – כפתור; אייפון – הסבר קצר) */
export default function InstallHint() {
  const [bip, setBip] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (sessionStorage.getItem("mg_install_dismissed")) return;
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    setIos(isIos);
    setHidden(!isIos);
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIP);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);
  if (hidden) return null;
  const dismiss = () => {
    sessionStorage.setItem("mg_install_dismissed", "1");
    setHidden(true);
  };
  return (
    <div className="mt-6 rounded-2xl border border-primary/25 bg-primary-tint/70 p-3 text-sm flex items-start gap-3">
      <span className="text-2xl">📲</span>
      <div className="flex-1 space-y-1">
        <div className="font-bold">אפשר לשים את זה על מסך הבית – כמו אפליקציה.</div>
        {bip ? (
          <button className="btn-primary text-sm" onClick={async () => { await bip.prompt(); dismiss(); }}>
            התקיני את האפליקציה
          </button>
        ) : ios ? (
          <div className="text-ink-soft">
            הכי טוב <b>מכרום</b>: תפריט ⋯ ← "הוסף למסך הבית". (אם הספארי בטלפון עושה בעיות – הקיצור מכרום עוקף אותו.)
          </div>
        ) : null}
      </div>
      <button className="text-faint text-lg leading-none" onClick={dismiss} aria-label="סגור">×</button>
    </div>
  );
}
