"use client";
import katex from "katex";
import { isolateMath } from "@/lib/bidi";
import { useEffect, useMemo, useRef } from "react";

/** מתחת לכמה קנה-מידה עדיף לתת לה לגלול אופקית ולא לכווץ עוד – שלא יצא זעיר מדי לקריאה */
const MIN_FIT_SCALE = 0.55;

/** Render a LaTeX string as display math */
export function Math({ latex, block = false, className = "" }: { latex: string; block?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: block, throwOnError: false, strict: false, trust: true });
    } catch {
      return latex;
    }
  }, [latex, block]);

  // תרגילים ארוכים (הרבה איברים) יכלו לצאת מהמסך בנייד. במקום לגלוש – מקטינים את הגופן (fontSize,
  // לא transform – כדי שהגובה יתאים את עצמו לבד ולא ייחתך שום דבר), ורק אם זה כבר לא מספיק נותנים
  // גלילה אופקית קלה בתוך המסגרת עצמה, לא בעמוד כולו.
  useEffect(() => {
    if (!block) return;
    const el = ref.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (!el || !inner) return;
    const fit = () => {
      inner.style.fontSize = "";
      const containerW = el.clientWidth;
      const contentW = inner.scrollWidth;
      if (containerW <= 0 || contentW <= containerW) return;
      // (הפונקציה כאן נקראת Math, כמו האובייקט הגלובלי – ניגשים אליו דרך globalThis כדי לא להתנגש)
      const rawScale = containerW / contentW;
      const scale = globalThis.Math.max(MIN_FIT_SCALE, rawScale);
      const naturalPx = parseFloat(getComputedStyle(inner).fontSize);
      if (naturalPx > 0) inner.style.fontSize = `${naturalPx * scale}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [html, block]);

  return <span ref={ref} className={`math-line ${block ? "block w-full overflow-x-auto" : "inline-block"} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Render Hebrew text with inline $...$ math and **bold** */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: { t: "text" | "math" | "bold"; v: string }[] = [];
    const re = /(\$[^$]+\$|\*\*[^*]+\*\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
      const tok = m[0];
      if (tok.startsWith("$")) out.push({ t: "math", v: tok.slice(1, -1) });
      else out.push({ t: "bold", v: tok.slice(2, -2) });
      last = m.index + tok.length;
    }
    if (last < text.length) out.push({ t: "text", v: text.slice(last) });
    return out;
  }, [text]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.t === "math" ? <Math key={i} latex={p.v} /> : p.t === "bold" ? <b key={i} className="text-amber-700">{isolateMath(p.v)}</b> : <span key={i}>{isolateMath(p.v)}</span>
      )}
    </span>
  );
}

/** Plain Hebrew string that may contain inline (non-LaTeX) math — bidi-safe. */
export function Txt({ s }: { s: string }) {
  return <>{isolateMath(s)}</>;
}
