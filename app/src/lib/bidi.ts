/**
 * Hebrew (RTL) paragraphs that contain inline LaTeX-free math like
 * "(a+b)², (a−b)²" get scrambled by the Unicode bidi algorithm — the trailing
 * superscript of the first item jumps to the end of the line.
 * We wrap each math run in LRI…PDI isolates so each run lays out LTR as a unit.
 */
const LRI = "⁦";
const PDI = "⁩";

// characters that may appear inside a math run
const TOK = "A-Za-z0-9()\\[\\]{}+\\-−*/^=<>≤≥≠·×÷±.,'\"²³⁴√∞…|";
// a run must contain at least one of these to count as math
const STRONG = /[=^²³⁴√+\-−*/×÷±≤≥≠·]|[A-Za-z0-9][()]|[()][A-Za-z0-9]/;

const RUN = new RegExp(`[${TOK}][${TOK} ]*`, "g");

/**
 * אופרטור בקצה הריצה = האופרנד שלו הוא הטקסט העברי שמסביב, לא חלק מהביטוי.
 * "2 חתולים + 6 חתולים = 8 חתולים" – לעטוף כאן את "+ 6" הופך את הסדר לקורא/ת עברית
 * ("חתולים 6 +"). מבודדים רק ביטוי עומד בפני עצמו, עם אופרנד משני צדי הסימן.
 * מינוס/פלוס צמודים למספר הם סימן של המספר עצמו ("-12") – אותם כן מבודדים.
 */
const OPENS_WITH_OPERATOR = /^([=<>≤≥≠*/×÷]|[+\-−±]\s)/;
const ENDS_WITH_OPERATOR = /[+\-−*/×÷=<>≤≥≠±][\s.,;:'"]*$/;

/** אות עברית */
const HEB = /[\u0590-\u05FF]/;

/**
 * סוגר שאין לו זוג בתוך הריצה שייך למשפט העברי שמסביב, לא לביטוי:
 * "פתרי את מערכת המשוואות (מצאי x ו-y):" – הריצה "-y)" סוחבת איתה את הסוגר
 * שסוגר את הסוגריים העבריים, ובידוד שלה הופך את סוף המשפט ל-"ו)y-:".
 */
function balancedFences(s: string): boolean {
  let d = 0;
  for (const c of s) {
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") {
      d--;
      if (d < 0) return false;
    }
  }
  return d === 0;
}

/** Wrap math-looking runs in bidi isolates so they render left-to-right inside RTL text. */
export function isolateMath(input: string): string {
  if (!input) return input;
  if (input.includes(LRI)) return input; // already processed
  return input.replace(RUN, (m: string, offset: number) => {
    let core = m.trim();
    // מקף שמחובר לאות עברית הוא מקף עברי ("ש-(a+b)", "ל-x") ולא מינוס של הביטוי –
    // הוא נשאר מחוץ לבידוד, ומה שאחריו נבדק בפני עצמו.
    let maqaf = "";
    if (/^[-−]/.test(core) && HEB.test(input[offset - 1] ?? "")) {
      maqaf = core.slice(0, 1);
      core = core.slice(1).trimStart();
    }
    if (core.length < 3) return m;
    if (!STRONG.test(core)) return m;
    // רק ביטוי אלגברי עם אותיות לטיניות באמת מתערבב ("(a±b)² = a² ± 2ab + b²").
    // ריצה של מספרים בלבד ("3 = 5.", "1·12, 2·6") מסתדרת לבד באלגוריתם הדו-כיווני,
    // ובידוד שלה דווקא הופך את הסדר לקורא/ת עברית.
    if (!/[A-Za-z]/.test(core)) return m;
    if (OPENS_WITH_OPERATOR.test(core) || ENDS_WITH_OPERATOR.test(core)) return m;
    if (!balancedFences(core)) return m;
    // פסיק בתוך ריצה מפריד לרוב בין חלקי משפט עברי ("ל-x, y מתחת ל-y") ולא בין אגפי ביטוי
    // ("x=1, y=3"). מבודדים רק אם כל קטע הוא ביטוי בפני עצמו.
    const commaParts = core.split(",").map((s) => s.trim()).filter(Boolean);
    if (commaParts.length > 1 && !commaParts.every((s) => STRONG.test(s))) return m;
    const lead = m.slice(0, m.length - m.trimStart().length);
    const tail = m.slice(m.trimEnd().length);
    return `${lead}${maqaf}${LRI}${core}${PDI}${tail}`;
  });
}
