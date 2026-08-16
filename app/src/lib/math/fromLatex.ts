/**
 * בונה תרגיל (Exercise) מתוך LaTeX שזוהה בצילום – בלי AI בבדיקה.
 * המודל רק קרא את התמונה; כל מה שקורה כאן דטרמיניסטי:
 *   ביטוי פולינומי → מרחיבים/מפרקים בעצמנו (Poly),   משוואה → קבוצת פתרונות,   מערכת לינארית → פתרון.
 */
import type { MathNode } from "mathjs";
import { Poly, polyLatex, polyPlain, frac, F, gcd } from "./poly";
import { parseExpr, normalizeInput, solutionSet, polyRootsReal, parenCount, math } from "./check";
import type { Exercise, StageInfo, Step } from "./types";

export type PhotoTask = "simplify" | "expand" | "factor" | "solve" | "compute" | "other";
export interface PhotoItem {
  latex: string;
  kind: "expr" | "equation" | "system" | "other";
  task: PhotoTask;
  equations?: string[];
  note?: string;
}

const S = (name: string, hint1: string, hint2: string): StageInfo => ({ name, hint1, hint2 });
const st = (latex: string, stage: number, note: string): Step => ({ latex, stage, note });
let counter = 0;
const uid = () => `photo-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/* ---------- mathjs node → Poly (polynomials with rational coefficients only) ---------- */
type N = MathNode & { op?: string; args?: MathNode[]; content?: MathNode; name?: string; value?: number; fn?: { name?: string } | string; isConstantNode?: boolean };

export function nodeToPoly(n0: MathNode): Poly | null {
  const n = n0 as N;
  switch (n.type) {
    case "ParenthesisNode":
      return nodeToPoly(n.content!);
    case "ConstantNode": {
      const v = Number(n.value);
      if (!Number.isFinite(v)) return null;
      // rational approximation for decimals like 0.5
      const s = String(v);
      if (s.includes(".")) {
        const dec = s.split(".")[1].length;
        if (dec > 6) return null;
        return Poly.const(frac(Math.round(v * 10 ** dec), 10 ** dec));
      }
      return Poly.const(v);
    }
    case "SymbolNode": {
      const name = n.name!;
      if (name === "pi" || name === "e") return null;
      return Poly.v(name);
    }
    case "OperatorNode": {
      const args = (n.args ?? []).map(nodeToPoly);
      if (args.some((a) => !a)) return null;
      const A = args as Poly[];
      switch (n.op) {
        case "+":
          return A.length === 1 ? A[0] : A[0].add(A[1]);
        case "-":
          return A.length === 1 ? A[0].neg() : A[0].sub(A[1]);
        case "*":
          return A[0].mul(A[1]);
        case "/": {
          if (!A[1].isConst()) return null; // חלוקה בנעלם – לא פולינום
          const c = A[1].constValue();
          if (F.isZero(c)) return null;
          return A[0].scale(F.div(frac(1), c));
        }
        case "^": {
          if (!A[1].isConst()) return null;
          const e = A[1].constValue();
          if (e.d !== 1 || e.n < 0 || e.n > 6) return null;
          return A[0].pow(e.n);
        }
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** parse LaTeX → Poly (or null if not a polynomial we can handle) */
export function latexToPoly(latex: string): Poly | null {
  const node = parseExpr(latex);
  if (!node) return null;
  try {
    return nodeToPoly(node);
  } catch {
    return null;
  }
}

/* ---------- factoring a univariate polynomial with rational roots ---------- */
function factorUnivariate(p: Poly): { latex: string; plain: string } | null {
  const vars = p.vars();
  if (vars.length !== 1) return null;
  const v = vars[0];
  const deg = p.degreeIn(v);
  if (deg < 2 || deg > 3) return null;
  // content (common integer factor) + monomial gcd
  const mono = p.monoGcd();
  const monoExp = mono[v] ?? 0;
  let q = monoExp ? p.divideByMono(mono) : p;
  const content = q.content();
  q = q.scale(F.div(frac(1), frac(content)));
  // integer coefficients now; roots
  const coeffs: number[] = [];
  const d = q.degreeIn(v);
  for (let i = 0; i <= d; i++) coeffs.push(q.coeffOf(v, i).constValue().n / q.coeffOf(v, i).constValue().d);
  const roots = polyRootsReal(coeffs);
  const lead = coeffs[d];
  // require all roots rational with small denominators
  const factors: Poly[] = [];
  let rest = q;
  let scalar = frac(content * (monoExp ? 1 : 1));
  const rat = (r: number): { n: number; d: number } | null => {
    for (let den = 1; den <= 12; den++) {
      const num = Math.round(r * den);
      if (Math.abs(num / den - r) < 1e-7) return { n: num, d: den };
    }
    return null;
  };
  if (roots.length < d) return null;
  for (const r of roots) {
    const rr = rat(r);
    if (!rr) return null;
    // factor (d x - n)
    const f = Poly.v(v).scale(rr.d).sub(Poly.const(rr.n));
    factors.push(f);
  }
  // scalar = lead / prod(dens)
  const prodDen = factors.reduce((s, f) => s * (f.coeffOf(v, 1).constValue().n), 1);
  const k = F.mul(scalar, frac(lead, prodDen));
  void rest;
  if (k.d !== 1) return null;
  const parts: string[] = [];
  const plainParts: string[] = [];
  const kk = k.n * (monoExp ? 1 : 1);
  const monoLatex = monoExp ? (monoExp === 1 ? v : `${v}^{${monoExp}}`) : "";
  const monoPlain = monoExp ? (monoExp === 1 ? v : `${v}^${monoExp}`) : "";
  if (kk !== 1 || (!monoExp && factors.length === 0)) parts.push(kk === -1 ? "-" : `${kk}`);
  if (kk !== 1) plainParts.push(`(${kk})`);
  if (monoLatex) parts.push(monoLatex);
  if (monoPlain) plainParts.push(monoPlain);
  for (const f of factors) {
    parts.push(`\\left(${polyLatex(f)}\\right)`);
    plainParts.push(`(${polyPlain(f)})`);
  }
  return { latex: parts.join(""), plain: plainParts.join("*") };
}

/* ---------- generic stages in Aran's language ---------- */
function exprStages(hasParens: boolean, hasPow: boolean, task: PhotoTask): StageInfo[] {
  const s: StageInfo[] = [];
  if (task === "factor") {
    s.push(S("ועד בית קודם", "לפני כל פירוק – יש גורם משותף לכולם? הוועד הקומוניסטי לוקח קודם.", "בדקי גורם משותף. אם אין – זוג שמסתדר או תאומים הפוכים."));
    s.push(S("הזוג שמסתדר / תאומים", "שאלה 1: החופשי – אותה כנופיה? שאלה 2: האמצעי – מי המנהיג? חוק הרשימה: עוברים על הזוגות פעם אחת.", "רשמי את הזוגות של האיבר החופשי וחפשי סכום שמתאים לאמצעי."));
    return s;
  }
  if (hasPow) s.push(S("האצבע / חזקה סנובית", "חזקה על סוגריים – זה כפל מקוצר: מסתירים, מרימים אצבע, מסתירים. שלושה איברים.", "פתחי את החזקה לפי (a±b)² = a² ± 2ab + b²."));
  if (hasParens) s.push(S("נשיקה לכולם", "הבחור עם המגנטים נצמד לכל איבר בסוגריים. מינוס לפני סוגריים הופך את כולם.", "פתחי את הסוגריים – כל איבר בחוץ כפול כל איבר בפנים."));
  s.push(S("איחוד משפחות", "חתולים עם חתולים, כלבים עם כלבים. סמני כל משפחה לפני שמחברים.", "חברי איברים דומים ושימי לב לסימנים."));
  return s;
}
function eqStages(): StageInfo[] {
  return [
    S("סוגריים ושברים", "אם יש סוגריים – נשיקה לכולם. אם יש שברים – מכפילים הכול במכנה המשותף (טרומפלדור).", "פתחי סוגריים / הכפילי במכנה המשותף – את כל הגושים."),
    S("מר גזען + שונא שליליים", "נעלמים לצד אחד, מספרים לצד שני. מה שעובר צד – עובר דרך מראת הקסמים ומתהפך.", "העבירי את האיקסים לצד שבו יצאו חיוביים ואת המספרים לצד השני."),
    S("איחוד משפחות וחילוק", "חתולים עם חתולים, ואז כפל עובר צד והופך לחילוק.", "חברי כל צד וחלקי במקדם של הנעלם. חזקה זוגית? זכרי ±."),
  ];
}

/* ---------- main builder ---------- */
export function exerciseFromPhoto(item: PhotoItem): { ex: Exercise } | { unsupported: string } {
  const latex = item.latex.trim();
  if (!latex) return { unsupported: "לא זוהה ביטוי." };

  if (item.kind === "system" || /\\begin\{cases\}/.test(latex)) {
    const eqs = (item.equations && item.equations.length >= 2 ? item.equations : latex.replace(/\\begin\{cases\}|\\end\{cases\}/g, "").split(/\\\\/)).map((s) => s.trim()).filter(Boolean);
    if (eqs.length !== 2) return { unsupported: "מערכת שאינה שתי משוואות – עוד לא נתמכת." };
    const sys = solveLinear2(eqs);
    if (!sys) return { unsupported: "המערכת אינה לינארית בשני נעלמים (או שאין לה פתרון יחיד)." };
    return {
      ex: {
        id: uid(),
        typeId: "custom",
        topicId: "photo",
        kind: "system",
        level: 2,
        instruction: "פתרי את המערכת (מהצילום):",
        promptLatex: `\\begin{cases}${eqs[0]}\\\\${eqs[1]}\\end{cases}`,
        finalLatex: sys.vars.map((v) => `${v}=${fmt(sys.sol[v])}`).join(",\\ "),
        vars: sys.vars,
        solutionMap: sys.sol,
        askFor: sys.vars,
        stages: [
          S("סובייטים מסודרים", "x מתחת ל-x, y מתחת ל-y, מספרים מימין. אם יש שברים – מכפילים את כל המשוואה.", "סדרי את שתי המשוואות אחת מתחת לשנייה."),
          S("גולאג – מחסלים נעלם", "יש נעלם – יש בעיה. סימנים הפוכים → מחברים; אותו סימן → מחסרים. מקדמים שונים? מכפילים משוואה שלמה קודם.", "הכפילי (אם צריך) וחברי/חסרי את המשוואות כדי שנעלם אחד ייעלם."),
          S("קרמבו", "מצאת נעלם אחד – מציבים באחת המשוואות (בסוגריים!) ומוצאים את השני.", "הציבי חזרה ומצאי את הנעלם השני."),
        ],
        steps: [st(sys.vars.map((v) => `${v}=${fmt(sys.sol[v])}`).join(",\\ "), 3, "הפתרון")],
        traps: [],
      },
    };
  }

  if (item.kind === "equation" || (latex.includes("=") && item.kind !== "expr")) {
    const vars = varsOf(latex);
    if (vars.length !== 1) return { unsupported: vars.length === 0 ? "לא מצאתי נעלם במשוואה." : "משוואה עם יותר מנעלם אחד – עוד לא נתמכת." };
    const v = vars[0];
    const ss = solutionSet(latex, v);
    if (ss.kind === "unknown") return { unsupported: "לא הצלחתי לחשב את קבוצת הפתרונות של המשוואה (אולי היא לא פולינומית)." };
    const solutions = ss.kind === "finite" ? ss.roots.map((r) => Math.round(r * 1e6) / 1e6) : ss.kind;
    const isQuad = ss.kind === "finite" && ss.roots.length === 2;
    return {
      ex: {
        id: uid(),
        typeId: "custom",
        topicId: "photo",
        kind: "equation",
        level: 2,
        instruction: "פתרי את המשוואה (מהצילום):",
        promptLatex: latex,
        finalLatex: solutions === "all" ? "\\text{כל } " + v : solutions === "none" ? "\\text{אין פתרון}" : solutions.map((r) => `${v}=${fmt(r)}`).join(",\\ "),
        variable: v,
        solutions,
        excluded: ss.kind === "finite" ? ss.excluded : undefined,
        stages: isQuad
          ? [
              S("הכול לצד אחד, = 0", "'מי גרם לאפס' עובד רק כשבצד השני יש 0. מר גזען: הכול לצד אחד – ריבועי, קווי, חופשי.", "העבירי הכול לצד אחד."),
              S("פירוק או נוסחה", "ועד בית קודם. אין חופשי? ועד בית. חסר אמצעי? שורש ו-±. אחרת – חוק הרשימה, ואם נגמרה הרשימה – נוסחה (שלוש שורות a, b, c).", "פרקי לגורמים או הציבי בנוסחת השורשים."),
              S("מי גרם לאפס?", "מכפלה שיצאה אפס – מישהו גרם לזה. כל גוש = 0. ואף פעם לא מחלקים ב-x לפני שבודקים אם הוא אפס.", "כתבי את שני הפתרונות."),
            ]
          : eqStages(),
        steps: [st(solutions === "all" ? "\\text{כל } " + v : solutions === "none" ? "\\text{אין פתרון}" : solutions.map((r) => `${v}=${fmt(r)}`).join(",\\ "), 3, "הפתרון")],
        stageOf: (info) => (info.lhs && info.rhs && parenCount(info.lhs) + parenCount(info.rhs) > 0 ? 0 : 1),
        traps: [],
      },
    };
  }

  // expression
  if (latex.includes("=")) return { unsupported: "זה נראה כמו משוואה, אבל סומן כביטוי – נסי לצלם שוב או לבחור 'משוואה'." };
  const p = latexToPoly(latex);
  if (!p) return { unsupported: "הביטוי מכיל חלוקה בנעלם, שורש או משהו שהמנוע עוד לא מלווה." };
  const plain = normalizeInput(latex);
  const node = parseExpr(latex)!;
  const hasParens = parenCount(node) > 0;
  const hasPow = /\^\{?2\}?/.test(latex) && hasParens;
  const numeric = p.vars().length === 0;
  const task: PhotoTask = item.task === "other" ? (numeric ? "compute" : hasParens ? "expand" : "simplify") : item.task;

  if (task === "factor") {
    const f = factorUnivariate(p);
    if (!f) return { unsupported: "לא הצלחתי לפרק את זה לגורמים עם שורשים רציונליים – אולי צריך נוסחה או שזה לא מתפרק." };
    return {
      ex: {
        id: uid(),
        typeId: "custom",
        topicId: "photo",
        kind: "expr",
        level: 2,
        instruction: "פרקי לגורמים (מהצילום):",
        promptLatex: latex,
        originalPlain: plain,
        finalPlain: f.plain,
        finalLatex: f.latex,
        finalForm: "factored",
        stages: exprStages(hasParens, hasPow, "factor"),
        steps: [st(f.latex, 2, "הפירוק")],
        stageOf: () => 0,
        traps: [],
      },
    };
  }

  const finalLatex = numeric ? fmt(p.constValue().n / p.constValue().d) : polyLatex(p);
  const finalPlain = numeric ? String(p.constValue().n / p.constValue().d) : polyPlain(p);
  return {
    ex: {
      id: uid(),
      typeId: "custom",
      topicId: "photo",
      kind: "expr",
      level: 2,
      instruction: numeric ? "חשבי (מהצילום):" : hasParens ? "פתחי סוגריים ופשטי (מהצילום):" : "פשטי (מהצילום):",
      promptLatex: latex,
      originalPlain: plain,
      finalPlain,
      finalLatex,
      finalForm: numeric ? "any" : "expanded",
      stages: numeric ? [S("סנובים קודם, ובזוג משמאל לימין", "סוגריים → חזקות ושורשים → כפל וחילוק → חיבור וחיסור. בתוך זוג – משמאל לימין.", "חשבי שלב-שלב לפי הסדר.")] : exprStages(hasParens, hasPow, task),
      steps: [st(finalLatex, 2, "התוצאה")],
      stageOf: (info) => (info.node && parenCount(info.node) > 0 ? 0 : 1),
      traps: [],
    },
  };
}

function fmt(x: number): string {
  if (Number.isInteger(x)) return String(x);
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-7) {
      const g = gcd(Math.abs(n), d);
      const nn = n / g,
        dd = d / g;
      return `${nn < 0 ? "-" : ""}\\frac{${Math.abs(nn)}}{${dd}}`;
    }
  }
  return String(Math.round(x * 1000) / 1000);
}

function varsOf(latex: string): string[] {
  const s = new Set<string>();
  for (const part of latex.split("=")) {
    const node = parseExpr(part);
    if (!node) continue;
    node.traverse((x) => {
      if (x.type === "SymbolNode") {
        const name = (x as unknown as { name: string }).name;
        if (!["e", "pi", "i"].includes(name) && !math[name as keyof typeof math]) s.add(name);
      }
    });
  }
  return [...s].sort();
}

/** solve two linear equations in two unknowns by sampling (exact for linear) */
function solveLinear2(eqs: string[]): { vars: string[]; sol: Record<string, number> } | null {
  const vars = [...new Set(eqs.flatMap(varsOf))].sort();
  if (vars.length !== 2) return null;
  const [a, b] = vars;
  const rows: number[][] = [];
  for (const eq of eqs) {
    const parts = eq.split("=");
    if (parts.length !== 2) return null;
    const diff = parseExpr(`(${normalizeInput(parts[0])})-(${normalizeInput(parts[1])})`);
    if (!diff) return null;
    const f = (x: number, y: number) => Number(diff.evaluate({ [a]: x, [b]: y }));
    const c0 = f(0, 0),
      ca = f(1, 0) - c0,
      cb = f(0, 1) - c0;
    // linearity check
    if (Math.abs(f(2, 3) - (c0 + 2 * ca + 3 * cb)) > 1e-7) return null;
    rows.push([ca, cb, -c0]);
  }
  const det = rows[0][0] * rows[1][1] - rows[0][1] * rows[1][0];
  if (Math.abs(det) < 1e-9) return null;
  const x = (rows[0][2] * rows[1][1] - rows[0][1] * rows[1][2]) / det;
  const y = (rows[0][0] * rows[1][2] - rows[0][2] * rows[1][0]) / det;
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return { vars, sol: { [a]: r6(x), [b]: r6(y) } };
}
