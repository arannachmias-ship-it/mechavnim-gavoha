import type { MathNode } from "mathjs";
import {
  exprEquivalent,
  nodesEquivalent,
  parseExpr,
  nodeCount,
  parenCount,
  solutionSet,
  sameRoots,
  parseFinalAssignment,
  parseMultiAssignment,
  splitEquation,
  normalizeInput,
  math,
} from "./check";
import type { Exercise, CheckResult } from "./types";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a));

function stripParens(n: MathNode): MathNode {
  let cur = n;
  while (cur.type === "ParenthesisNode") cur = (cur as unknown as { content: MathNode }).content;
  return cur;
}
function isProductForm(n: MathNode): boolean {
  const c = stripParens(n);
  if (c.type === "OperatorNode") {
    const op = (c as unknown as { op: string; args: MathNode[] }).op;
    const args = (c as unknown as { args: MathNode[] }).args;
    if (op === "*") return true;
    if (op === "-" && args.length === 1) return isProductForm(args[0]);
    if (op === "^") return true;
  }
  return false;
}
function hasSumInsideProductOrPower(n: MathNode): boolean {
  // parentheses containing +/-  ⇒ not expanded
  return parenCount(n) > 0;
}

function trapMessage(ex: Exercise, plain: string): { message: string; mistake?: string } | null {
  if (!ex.traps) return null;
  for (const t of ex.traps) {
    if ((ex.kind === "expr" || ex.kind === "fracdomain") && exprEquivalent(plain, t.plain)) return { message: t.message, mistake: t.mistake };
  }
  return null;
}

/* ---------------- תחום הצבה ---------------- */
/** parse a domain line like "x≠0, x≠4" / "x≠0,4" / "x ne 0" → list of excluded values, or null */
export function parseDomainLine(raw: string, v = "x"): number[] | null {
  let s = raw.replace(/\\neq?/g, "≠").replace(/\\neq/g, "≠").replace(/!=/g, "≠").replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (!s.includes("≠")) return null;
  s = s.replace(/\\left\(|\\right\)|\\left|\\right/g, "").replace(/\\pm/g, "±").replace(/\\/g, "");
  const vals: number[] = [];
  const parts = s.split(/[,;]|(?:או)|(?:ו)/).filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^(?:([a-zA-Z])≠)?([±]?-?\d+(?:\.\d+)?(?:\/\d+)?)$/);
    if (!m) return null;
    if (m[1] && m[1] !== v) return null;
    let txt = m[2];
    const pm = txt.startsWith("±");
    if (pm) txt = txt.slice(1);
    let n: number;
    if (txt.includes("/")) {
      const [a, b] = txt.split("/").map(Number);
      n = a / b;
    } else n = Number(txt);
    if (!Number.isFinite(n)) return null;
    vals.push(n);
    if (pm) vals.push(-n);
  }
  return vals.length ? vals : null;
}

/** normalize student text: strip Hebrew, spaces */
function clean(input: string) {
  return input.replace(/[֐-׿]/g, "").trim();
}

export function checkLine(ex: Exercise, history: string[], rawInput: string): CheckResult {
  if (ex.kind === "equation") {
    const sol = ex.solutions!;
    if (/אין\s*פתרון|אין\s*x|NONE/i.test(rawInput) || rawInput.trim() === "∅") {
      return sol === "none"
        ? { status: "done", message: "נכון – אין x שמקיים את המשוואה. ✔", stage: ex.stages.length }
        : { status: "wrong", message: "יש פתרון! נסי להמשיך לפתור.", stage: 0 };
    }
    if (/כל\s*x|ALL/i.test(rawInput)) {
      return sol === "all"
        ? { status: "done", message: "נכון – כל x מקיים את המשוואה (0 = 0). ✔", stage: ex.stages.length }
        : { status: "wrong", message: "לא כל x. תמשיכי לבודד.", stage: 0 };
    }
  }
  const input = clean(rawInput);
  if (!input) return { status: "unparsable", message: "כתבי משהו קודם 🙂", stage: 0 };
  if (ex.kind === "expr") return checkExpr(ex, history, input);
  if (ex.kind === "equation") return checkEquation(ex, history, input);
  if (ex.kind === "fracdomain") return checkFracDomain(ex, history, rawInput);
  return checkSystem(ex, history, input);
}

/* ---------------- שברים אלגבריים עם תחום הצבה ---------------- */
function checkFracDomain(ex: Exercise, history: string[], rawInput: string): CheckResult {
  const excluded = ex.excluded ?? [];
  const domainDone = history.some((h) => parseDomainLine(h) !== null);
  const dom = parseDomainLine(rawInput);
  if (dom) {
    if (domainDone) return { status: "same", message: "תחום ההצבה כבר כתוב. עכשיו מפרקים לגושים.", stage: 1 };
    const missing = excluded.filter((e) => !dom.some((d) => near(d, e)));
    const extra = dom.filter((d) => !excluded.some((e) => near(d, e)));
    if (!missing.length && !extra.length) {
      return { status: "ok", message: "השומר בכניסה עומד. עכשיו מותר לגעת בשבר.", stage: 1 };
    }
    if (missing.length && !extra.length) {
      return { status: "wrong", message: `חסר מישהו ברשימה של השומר. המכנה מתאפס בעוד ערך – מי גרם לאפס? (רמז: פרקי את המכנה לגושים.)`, stage: 0, mistake: "domain_missing" };
    }
    return { status: "wrong", message: `${extra.length === 1 ? "הערך " + extra[0] : "חלק מהערכים"} לא מאפס את המכנה. השומר אוסר רק על מי שבאמת עושה אפס למטה. בדקי בהצבה.`, stage: 0, mistake: "domain_wrong" };
  }
  // an algebra line
  const input = clean(rawInput);
  if (!domainDone) {
    // the ONE hard stop in the app: no algebra before the domain
    return {
      status: "wrong",
      message: "רגע – עוד לא כתבת תחום הצבה. לא מצמצמים לפני שהשומר בכניסה עומד – אחרת עלולים לחלק באפס והיקום קורס. כתבי קודם x≠…",
      stage: 0,
      mistake: "domain_first",
    };
  }
  const res = checkExpr(ex, history.filter((h) => parseDomainLine(h) === null), input);
  if (res.status === "done") return { ...res, message: "יפה – גושים למעלה, גושים למטה, ורק גוש מול גוש הצטמצם. עם תחום ההצבה לידו זו תשובה של בגרות. ✔" };
  return { ...res, stage: Math.max(res.stage, 1) };
}

/* ---------------- expressions ---------------- */
function checkExpr(ex: Exercise, history: string[], input: string): CheckResult {
  if (input.includes("=")) {
    // allow "= expr" prefix, or "orig = expr"
    const parts = input.split("=").map((s) => s.trim()).filter(Boolean);
    input = parts[parts.length - 1];
  }
  const node = parseExpr(input);
  if (!node) return { status: "unparsable", message: "לא הצלחתי לקרוא את זה. בדקי סוגריים וסימנים.", stage: 0 };
  const plain = normalizeInput(input);
  const prev = history.length ? normalizeInput(clean(history[history.length - 1])) : normalizeInput(ex.originalPlain ?? "");
  const stage = ex.stageOf ? ex.stageOf({ node, plain }) : 0;

  if (!exprEquivalent(plain, ex.originalPlain!)) {
    const trap = trapMessage(ex, plain);
    return {
      status: "wrong",
      message: trap?.message ?? "השורה הזאת לא שווה לביטוי המקורי. משהו השתבש – בדקי סימנים, כפל, ומי קיבל נשיקה.",
      stage,
      mistake: trap?.mistake,
    };
  }
  if (plain === prev || (history.length && nodesEquivalent(node, parseExpr(prev)!) && nodeCount(node) === nodeCount(parseExpr(prev)!) && plain.replace(/\s/g, "") === prev.replace(/\s/g, ""))) {
    return { status: "same", message: "זה בדיוק מה שכבר כתוב. תתקדמי צעד.", stage };
  }
  const finalNode = parseExpr(ex.finalPlain!)!;
  const fc = nodeCount(finalNode);
  const sc = nodeCount(node);
  let done = false;
  const form = ex.finalForm ?? "any";
  if (form === "expanded") done = sc <= fc && !hasSumInsideProductOrPower(node);
  else if (form === "factored") done = sc <= fc && isProductForm(node);
  else done = sc <= fc;
  if (done) return { status: "done", message: "יפה! זה מסודר עד הסוף. ✔", stage: ex.stages.length };
  return { status: "ok", message: "נכון, ממשיכים.", stage };
}

/* ---------------- single-variable equations ---------------- */
function checkEquation(ex: Exercise, history: string[], input: string): CheckResult {
  const v = ex.variable ?? "x";
  const sol = ex.solutions!;
  // final answer forms
  if (/אין\s*פתרון|אין\s*x|NONE/i.test(input) || input === "∅") {
    return sol === "none"
      ? { status: "done", message: "נכון – אין x שמקיים את המשוואה. ✔", stage: ex.stages.length }
      : { status: "wrong", message: "יש פתרון! נסי להמשיך לפתור.", stage: 0 };
  }
  if (/כל\s*x|ALL/i.test(input)) {
    return sol === "all"
      ? { status: "done", message: "נכון – כל x מקיים את המשוואה (0 = 0). ✔", stage: ex.stages.length }
      : { status: "wrong", message: "לא כל x. תמשיכי לבודד.", stage: 0 };
  }
  // "a=2, b=-5, c=-3" – the three lines before touching the formula
  const abcLine = input.replace(/\s/g, "").match(/^a=(-?[\d.]+),?b=(-?[\d.]+),?c=(-?[\d.]+)$/i);
  if (abcLine) {
    if (!ex.abc) return { status: "notprogress", message: "פה לא צריך נוסחה – יש דרך קצרה יותר. בדקי: גורם משותף? חוק הרשימה?", stage: 0 };
    const got = abcLine.slice(1, 4).map(Number);
    const okAbc = got.every((g, i) => near(g, ex.abc![i]));
    if (okAbc) return { status: "ok", message: "שלוש שורות, עם הסימנים. עכשיו הנוסחה – מהנוסחאון.", stage: 1 };
    const wrongSign = got.every((g, i) => near(Math.abs(g), Math.abs(ex.abc![i])));
    return { status: "wrong", message: wrongSign ? "המספרים נכונים – הסימן לא. a, b, c באים עם הסימן שלהם, וזו בדיוק הטעות שהשלוש שורות באו למנוע." : "לא. סדרי קודם: ריבועי, קווי, חופשי – והכול בצד אחד. אז a הוא המקדם של x², b של x, c החופשי.", stage: 0, mistake: "abc" };
  }
  // "b²−4ac = -15 < 0" – the discriminant line
  const discLine = input.replace(/\s/g, "").match(/^(?:b\^?\{?2\}?-4ac|Δ|D)=(-?\d+(?:\.\d+)?)(<0|>0|=0)?$/);
  if (discLine && ex.abc) {
    const [a, b, c] = ex.abc;
    const d = b * b - 4 * a * c;
    if (near(Number(discLine[1]), d)) {
      if (d < 0) return { status: "ok", message: "מתחת לשורש שלילי – אין פתרון. עוצרים כאן. לחצי 'אין פתרון'.", stage: ex.stages.length - 1 };
      return { status: "ok", message: `מתחת לשורש ${d} – חיובי, יש פתרונות. שורש ${d} = ${Math.sqrt(d) % 1 === 0 ? Math.sqrt(d) : Math.sqrt(d).toFixed(2)}.`, stage: 1 };
    }
    return { status: "wrong", message: `b²−4ac לא יוצא ${discLine[1]}. בדקי את הסימנים – (${b})² הוא תמיד חיובי, ו-4·(${a})·(${c}) עם הסימן של c.`, stage: 1, mistake: "formula" };
  }
  // "x = (5 ± 7) / 4" style – accept the ± line if it yields the right roots
  if (/±|\\pm/.test(input) && Array.isArray(sol)) {
    const norm = normalizeInput(input.replace(/_\{[^}]*\}|_\d/g, ""));
    const segs = norm.split("=");
    const m = segs.length >= 2 && segs[0] === "x" ? [norm, segs[segs.length - 1]] : null;
    if (m) {
      const plus = m[1].replace(/±/g, "+"),
        minus = m[1].replace(/±/g, "-");
      const vp = parseExpr(plus)?.evaluate?.({}),
        vm = parseExpr(minus)?.evaluate?.({});
      if (typeof vp === "number" && typeof vm === "number") {
        if (sameRoots([vp, vm], sol)) return { status: "ok", message: "נכון. עכשיו פלוס בנפרד ומינוס בנפרד – שני הפתרונות.", stage: ex.stages.length - 1 };
        return { status: "wrong", message: "משהו בהצבה לא מסתדר – בדקי את הסימנים של b ושל c בתוך הנוסחה, ואת 2a במכנה.", stage: 1, mistake: "formula" };
      }
    }
  }
  const multi = parseMultiAssignment(input, v);
  if (multi && Array.isArray(sol)) {
    if (sameRoots(multi, sol)) return { status: "done", message: "מצוין! הצבי לבדוק ותסמני. ✔", stage: ex.stages.length };
    // partial (one of two roots)
    if (multi.length === 1 && sol.length === 2 && sol.some((s) => near(s, multi[0]))) {
      const lostZero = sol.some((s) => near(s, 0)) && !near(multi[0], 0);
      return {
        status: "ok",
        message: lostZero
          ? "זה אחד הפתרונות – אבל x=0 גם פותר. אם חילקת ב-x, איבדת אותו: אף פעם לא מחלקים ב-x לפני שבודקים אם הוא אפס."
          : "זה אחד הפתרונות. חזקה זוגית תמיד מחזירה שניים – חיובי ושלילי. מי ששכח את המינוס שכח חצי מהתשובה.",
        stage: ex.stages.length - 1,
        mistake: lostZero ? "divx" : "pm",
      };
    }
    if (multi.length === 1 && sol.length === 1) {
      return { status: "wrong", message: `לא. הציבי את ${multi[0]} חזרה במשוואה המקורית ותראי שזה לא מסתדר.`, stage: ex.stages.length - 1 };
    }
    return { status: "wrong", message: "לא בדיוק. בדקי את הפתרונות בהצבה.", stage: ex.stages.length - 1 };
  }
  const eq = splitEquation(input);
  if (!eq) return { status: "unparsable", message: "כתבי משוואה שלמה עם סימן =, או תשובה סופית כמו x=5.", stage: 0 };
  const lhs = parseExpr(eq.lhs),
    rhs = parseExpr(eq.rhs);
  if (!lhs || !rhs) return { status: "unparsable", message: "לא הצלחתי לקרוא את המשוואה. בדקי סוגריים.", stage: 0 };
  const stage = ex.stageOf ? ex.stageOf({ lhs, rhs, plain: normalizeInput(input) }) : 0;
  const ss = solutionSet(input, v);
  const prevLine = history.length ? clean(history[history.length - 1]) : "";
  if (prevLine && normalizeInput(prevLine).replace(/\s/g, "") === normalizeInput(input).replace(/\s/g, ""))
    return { status: "same", message: "זו אותה שורה. תתקדמי צעד.", stage };
  let ok = false;
  if (ss.kind === "unknown") {
    // fallback: check equality of both sides difference vs original? try numeric at solutions
    if (Array.isArray(sol)) {
      ok = sol.every((s) => {
        try {
          const l = lhs.evaluate({ [v]: s }),
            r = rhs.evaluate({ [v]: s });
          return Math.abs(l - r) < 1e-6;
        } catch {
          return false;
        }
      });
    }
  } else if (sol === "all") ok = ss.kind === "all";
  else if (sol === "none") ok = ss.kind === "none";
  else if (ss.kind === "finite") {
    // allow extra roots only if they are excluded-domain values of the original
    const extra = ss.roots.filter((r) => !sol.some((s) => near(s, r)));
    const covered = sol.every((s) => ss.roots.some((r) => near(s, r)));
    ok = covered && extra.every((r) => (ex as unknown as { excluded?: number[] }).excluded?.some((e) => near(e, r)) ?? false);
  }
  if (!ok) {
    // divide-by-x: student's line kept every root except 0
    if (Array.isArray(sol) && ss.kind === "finite" && sol.some((s) => near(s, 0))) {
      const others = sol.filter((s) => !near(s, 0));
      const keptOthers = others.length > 0 && others.every((s) => ss.roots.some((r) => near(r, s)));
      const lostZero = !ss.roots.some((r) => near(r, 0));
      const nothingExtra = ss.roots.every((r) => sol.some((s) => near(s, r)));
      if (keptOthers && lostZero && nothingExtra) {
        return {
          status: "wrong",
          message: "חילקת ב-x – ואיבדת את הפתרון x=0. אף פעם, ואני חוזר – אף פעם – לא מחלקים ב-x לפני שבודקים את האפשרות שהוא אפס. במקום לחלק: ועד בית, x בחוץ, ואז שואלים מי גרם לאפס.",
          stage,
          mistake: "divx",
        };
      }
    }
    return {
      status: "wrong",
      message: wrongEquationMessage(ex, lhs, rhs, ss),
      stage,
      detail: ss.kind === "finite" ? `roots ${ss.roots.map((r) => r.toFixed(3)).join(",")}` : ss.kind,
      mistake: "mirror",
    };
  }
  return { status: "ok", message: "נכון, ממשיכים.", stage };
}

function wrongEquationMessage(ex: Exercise, lhs: MathNode, rhs: MathNode, ss: ReturnType<typeof solutionSet>): string {
  void lhs;
  void rhs;
  void ss;
  const t = ex.traps?.[0];
  void t;
  return "השורה הזאת לא שקולה לקודמת – משהו לא עבר נכון. זכרי: מה שעובר צד מתהפך (מראת הקסמים), ומינוס לפני סוגריים הופך את כולם.";
}

/* ---------------- systems ---------------- */
function checkSystem(ex: Exercise, history: string[], input: string): CheckResult {
  const vars = ex.vars ?? ["x", "y"];
  const solMap = ex.solutionMap!;
  const ask = ex.askFor ?? vars;
  // final: "x=3" or "x=3, y=2"
  const assigns: Record<string, number> = {};
  const parts = input.replace(/או|;/g, ",").split(",").map((s) => s.trim()).filter(Boolean);
  let allAssign = parts.length > 0;
  for (const p of parts) {
    let matched = false;
    for (const v of vars) {
      const val = parseFinalAssignment(p, v);
      if (typeof val === "number") {
        assigns[v] = val;
        matched = true;
        break;
      }
    }
    if (!matched) allAssign = false;
  }
  // collect from history too
  const known: Record<string, number> = {};
  for (const h of history) {
    for (const p of clean(h).replace(/או|;/g, ",").split(",")) {
      for (const v of vars) {
        const val = parseFinalAssignment(p.trim(), v);
        if (typeof val === "number" && near(val, solMap[v])) known[v] = val;
      }
    }
  }
  if (allAssign) {
    for (const [v, val] of Object.entries(assigns)) {
      if (!near(val, solMap[v])) return { status: "wrong", message: `${v} לא יוצא ${val}. הציבי חזרה בשתי המשוואות ותראי.`, stage: ex.stages.length - 1 };
      known[v] = val;
    }
    const doneAll = ask.every((v) => v in known);
    if (doneAll) return { status: "done", message: "מעולה – הנעלמים חוסלו והפתרון נכון! ✔", stage: ex.stages.length };
    return { status: "ok", message: `נכון! עכשיו מצאי את ${ask.filter((v) => !(v in known)).join(", ")}.`, stage: ex.stages.length - 1 };
  }
  // an equation line
  const eq = splitEquation(input);
  if (!eq) return { status: "unparsable", message: "כתבי משוואה (עם =) או תשובה כמו x=3.", stage: 0 };
  const lhs = parseExpr(eq.lhs),
    rhs = parseExpr(eq.rhs);
  if (!lhs || !rhs) return { status: "unparsable", message: "לא הצלחתי לקרוא את המשוואה.", stage: 0 };
  const stage = ex.stageOf ? ex.stageOf({ lhs, rhs, plain: normalizeInput(input) }) : 0;
  let satisfied = false;
  try {
    const l = lhs.evaluate(solMap),
      r = rhs.evaluate(solMap);
    satisfied = Math.abs(l - r) < 1e-6;
  } catch {
    satisfied = false;
  }
  if (!satisfied)
    return {
      status: "wrong",
      message: "המשוואה הזאת לא מסתדרת עם הפתרון – כנראה טעות בחיבור/חיסור או בהכפלה. זכרי: מכפילים את *כל* המשוואה, גם את הצד הימני.",
      stage,
    };
  // identity check (0=0)
  try {
    const diff = math.parse(`(${normalizeInput(eq.lhs)})-(${normalizeInput(eq.rhs)})`);
    const vals = [1.3, -2.1, 0.7].map((t) => diff.evaluate({ x: t, y: t * 1.7 + 0.3, a: t, b: -t }));
    if (vals.every((v) => Math.abs(v) < 1e-9)) return { status: "notprogress", message: "זה 0=0 – נכון אבל לא מקדם. נסי לחסל נעלם.", stage };
  } catch {
    /* ignore */
  }
  const prevLine = history.length ? clean(history[history.length - 1]) : "";
  if (prevLine && normalizeInput(prevLine).replace(/\s/g, "") === normalizeInput(input).replace(/\s/g, ""))
    return { status: "same", message: "זו אותה שורה.", stage };
  return { status: "ok", message: "נכון, ממשיכים.", stage };
}
