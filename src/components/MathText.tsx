"use client";
import katex from "katex";
import { isolateMath } from "@/lib/bidi";
import { useMemo } from "react";

/** Render a LaTeX string as display math */
export function Math({ latex, block = false, className = "" }: { latex: string; block?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: block, throwOnError: false, strict: false, trust: true });
    } catch {
      return latex;
    }
  }, [latex, block]);
  return <span className={`math-line ${block ? "block" : "inline-block"} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
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
