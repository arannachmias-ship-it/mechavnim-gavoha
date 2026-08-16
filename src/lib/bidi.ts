/**
 * Hebrew (RTL) paragraphs that contain inline LaTeX-free math like
 * "(a+b)², (a−b)²" get scrambled by the Unicode bidi algorithm — the trailing
 * superscript of the first item jumps to the end of the line.
 * We wrap each math run in LRI…PDI isolates so each run lays out LTR as a unit.
 */
const LRI = "\u2066";
const PDI = "\u2069";

const TOK = "A-Za-z0-9()\\[\\]{}+\\-−*/^=<>≤≥≠·×÷±.,'\\"²³⁴√∞|";
const STRONG = /[=^²³⁴√+\-−*/×÷±≤≥≠]|[A-Za-z0-9][()]|[()][A-Za-z0-9]/;
const RUN = new RegExp(`[${TOK}][${TOK} ]*`, "g");

/** Wrap math-looking runs in bidi isolates so they render left-to-right inside RTL text. */
export function isolateMath(input: string): string {
  if (!input) return input;
  if (input.includes(LRI)) return input;
  return input.replace(RUN, (m) => {
    const core = m.trim();
    if (core.length < 3) return m;
    if (!STRONG.test(core)) return m;
    if (!/[A-Za-z0-9]/.test(core)) return m;
    const lead = m.slice(0, m.length - m.trimStart().length);
    const tail = m.slice(m.trimEnd().length);
    return `${lead}${LRI}${core}${PDI}${tail}`;
  });
}
