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

function trapMessage(ex: Exercise, plain: string): string | null {
  if (!ex.traps) return null;
  for (const t of ex.traps) {
    if (ex.kind === "expr" && exprEquivalent(plain, t.plain)) return t.message;
  }
  return null;
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
  return checkSystem(ex, history, input);
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
      message: trap ?? "השורה הזאת לא שווה לביטוי המקורי. משהו השתבש – בדקי סימנים, כפל, ומי קיבל נשיקה.",
      stage,
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
  const multi = parseMultiAssignment(input, v);
  if (multi && Array.isArray(sol)) {
    if (sameRoots(multi, sol)) return { status: "done", message: "מצוין! הצבי לבדוק ותסמני. ✔", stage: ex.stages.length };
    // partial (one of two roots)
    if (multi.length === 1 && sol.length === 2 && sol.some((s) => near(s, multi[0])))
      return { status: "ok", message: "זה אחד הפתרונות. יש עוד אחד – חזקה זוגית = שני פתרונות.", stage: ex.stages.length - 1 };
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
    return {
      status: "wrong",
      message: wrongEquationMessage(ex, lhs, rhs, ss),
      stage,
      detail: ss.kind === "finite" ? `roots ${ss.roots.map((r) => r.toFixed(3)).join(",")}` : ss.kind,
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
