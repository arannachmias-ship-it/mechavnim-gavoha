import type { MathNode } from "mathjs";
import { Poly, polyLatex, polyPlain, parenIfNeeded, rint, rnz, pick, shuffle, frac, F, gcd, fracLatex } from "./poly";
import { parenCount, hasDivision, nodeVars, nodeCount, parseExpr } from "./check";
import type { Exercise, StageInfo, Step, Trap } from "./types";

let counter = 0;
const uid = (t: string) => `${t}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const L = polyLatex;
const P = polyPlain;

/* ---------- shared stage classifiers ---------- */

type EqTag = "parens" | "fractions" | "liberman" | "families" | "divide" | "final";
function eqTag(lhs: MathNode, rhs: MathNode, v: string): EqTag {
  if (parenCount(lhs) + parenCount(rhs) > 0) return "parens";
  if (hasDivision(lhs) || hasDivision(rhs)) return "fractions";
  const lv = nodeVars(lhs).includes(v),
    rv = nodeVars(rhs).includes(v);
  if (lv && rv) return "liberman";
  const varSide = lv ? lhs : rhs;
  const numSide = lv ? rhs : lhs;
  if (nodeCount(varSide) > 3 || nodeCount(numSide) > 1) return "families";
  if (nodeCount(varSide) > 1) return "divide";
  return "final";
}
function eqStageOf(map: Partial<Record<EqTag, number>>, v = "x") {
  return (info: { lhs?: MathNode; rhs?: MathNode }) => {
    if (!info.lhs || !info.rhs) return 0;
    const t = eqTag(info.lhs, info.rhs, v);
    return map[t] ?? 0;
  };
}
/** expression stage: parens present → 0, else 1 */
const exprParenStage = (info: { node?: MathNode }) => (info.node && parenCount(info.node) > 0 ? 0 : 1);

const S = (name: string, hint1: string, hint2: string): StageInfo => ({ name, hint1, hint2 });
const st = (latex: string, stage: number, note: string): Step => ({ latex, stage, note });

const VARS2 = [
  ["x", "y"],
  ["a", "b"],
  ["m", "n"],
  ["t", "y"],
] as const;

/* =====================================================================
   1. איחוד משפחות – חיבור וחיסור נעלמים
   ===================================================================== */
export function genLikeTerms(level: number): Exercise {
  const [v1, v2] = pick(VARS2);
  const n = level === 1 ? 4 : level === 2 ? 5 : 6;
  const parts: Poly[] = [];
  const kinds: Poly[] = [Poly.v(v1), Poly.v(v2), Poly.const(1)];
  if (level >= 2) kinds.push(Poly.v(v1, 2));
  if (level >= 3) kinds.push(Poly.v(v1).mul(Poly.v(v2)));
  // ensure at least two of the same family
  const chosen = shuffle([...kinds.slice(0, 2), ...kinds.slice(0, 2), ...Array.from({ length: n - 4 }, () => pick(kinds))]);
  for (const k of chosen) parts.push(k.scale(rnz(-9, 9)));
  const total = parts.reduce((a, b) => a.add(b), Poly.zero());
  // render prompt as sequence of signed terms in given order
  let prompt = "";
  parts.forEach((p, i) => {
    const s = L(p);
    prompt += i === 0 ? s : s.startsWith("-") ? s : "+" + s;
  });
  const plainPrompt = parts.map((p) => `(${P(p)})`).join("+");
  const stages = [
    S(
      "איחוד משפחות",
      "כל נעלם הולך עם המשפחה שלו: חתולים עם חתולים, כלבים עם כלבים. סמני כל משפחה בצבע (או בעיגול/משולש) לפני שמחברים.",
      `אספי את כל ה-${v1} ביחד, את כל ה-${v2} ביחד, ואת המספרים ביחד – ואז חברי כל משפחה בנפרד. שימי לב לסימן שלפני כל איבר!`
    ),
  ];
  return {
    id: uid("like"),
    typeId: "like_terms",
    topicId: "families",
    kind: "expr",
    level,
    instruction: "כנסי איברים דומים ופשטי:",
    promptLatex: prompt,
    originalPlain: plainPrompt,
    finalPlain: P(total),
    finalLatex: L(total),
    finalForm: "expanded",
    stages,
    steps: [st(L(total), 1, "אחרי איחוד המשפחות")],
    stageOf: () => 0,
    traps: [],
  };
}

/* =====================================================================
   2. כפל נעלמים – הכל נשאר במשפחה
   ===================================================================== */
export function genMonoMul(level: number): Exercise {
  const v = pick(["x", "b", "c", "a"]);
  const mk = (c: number, e: number) => Poly.v(v, e, c);
  const factors: Poly[] = [];
  const cnt = level === 1 ? 2 : 3;
  for (let i = 0; i < cnt; i++) factors.push(mk(rnz(-9, 9), rint(1, level === 1 ? 3 : 6)));
  const prod = factors.reduce((a, b) => a.mul(b), Poly.const(1));
  let prompt = factors.map((f) => parenIfNeeded(f)).join("\\cdot ");
  let plain = factors.map((f) => `(${P(f)})`).join("*");
  let total = prod;
  const stages = [
    S(
      "כפל – הכל נשאר במשפחה",
      "בכפל כל אחד הולך עם המשפחה שלו: קודם קובעים סימן (נישואים: מינוס·מינוס = פלוס), אחר-כך מספרים עם מספרים, ואז נעלמים עם נעלמים.",
      `כפלי את המקדמים ביניהם, ואת ה-${v} כפול ${v} – מחברים מעריכים (x·x² = x³).`
    ),
  ];
  const steps: Step[] = [st(L(prod), 1, "אחרי הכפל")];
  if (level === 3) {
    // sum of two products with like terms
    const f2 = [mk(rnz(-9, 9), rint(1, 5)), mk(rnz(-9, 9), rint(1, 5))];
    const deg = prod.degreeIn(v);
    // force second product to have same degree
    f2[1] = mk(f2[1].orderedTerms()[0].coef.n, Math.max(1, deg - f2[0].degreeIn(v)));
    const prod2 = f2[0].mul(f2[1]);
    const sign = pick(["-", "+"]);
    prompt += `${sign}${f2.map((f) => parenIfNeeded(f)).join("\\cdot ")}`;
    plain += `${sign}${f2.map((f) => `(${P(f)})`).join("*")}`;
    total = sign === "-" ? prod.sub(prod2) : prod.add(prod2);
    stages.push(S("איחוד משפחות", "עכשיו שיש רק איברים בלי כפל ביניהם – חתולים עם חתולים.", "חברי/חסרי את האיברים עם אותה חזקה."));
    steps.length = 0;
    steps.push(st(`${L(prod)}${sign}${L(prod2)}`, 1, "אחרי הכפל של כל מכפלה"), st(L(total), 2, "אחרי איחוד משפחות"));
  }
  return {
    id: uid("mono"),
    typeId: "mono_mul",
    topicId: "families",
    kind: "expr",
    level,
    instruction: "כפלי ופשטי ככל האפשר:",
    promptLatex: prompt,
    originalPlain: plain,
    finalPlain: P(total),
    finalLatex: L(total),
    finalForm: "expanded",
    stages,
    steps,
    stageOf: (info) => (info.node && /\*\(|\)\*/.test(info.plain) ? 0 : stages.length - 1),
    traps: [],
  };
}

/* =====================================================================
   3. סוגריים – הבחור עם המגנטים
   ===================================================================== */
export function genDistribute(level: number): Exercise {
  const [v1, v2] = pick(VARS2);
  const x = Poly.v(v1);
  const traps: Trap[] = [];
  let prompt = "",
    plain = "";
  const steps: Step[] = [];
  let total: Poly;
  const stages: StageInfo[] = [];

  if (level === 1) {
    // a(bx+c)  or -(bx+c)
    const a = pick([-1, rnz(-7, 7)]);
    const inner = x.scale(rnz(-9, 9)).add(Poly.const(rnz(-9, 9)));
    total = inner.scale(a);
    const aStr = a === -1 ? "-" : a === 1 ? "" : `${a}`;
    prompt = `${aStr}\\left(${L(inner)}\\right)`;
    plain = `(${a})*(${P(inner)})`;
    // trap: only first term multiplied
    const t = inner.orderedTerms();
    const wrong = Poly.term(F.mul(t[0].coef, frac(a)), t[0].mono).add(Poly.term(t[1].coef, t[1].mono));
    traps.push({ plain: P(wrong), message: "המגנט חייב להיצמד לכולם! נתת נשיקה רק לאיבר הראשון – גם השני צריך לקבל." });
    if (a < 0) {
      const wrong2 = Poly.term(F.mul(t[0].coef, frac(a)), t[0].mono).add(Poly.term(F.mul(t[1].coef, frac(-a)), t[1].mono));
      traps.push({ plain: P(wrong2), message: "מינוס לפני סוגריים הופך את *כולם* – גם הסימן של האיבר השני מתהפך." });
    }
    stages.push(S("נשיקה לכולם", "מה שצמוד לסוגריים הוא הבחור עם המגנטים – הוא חייב להידבק לכל איבר בפנים. אם הוא מינוס – הוא הופך את כולם.", `כפלי את ${aStr || "המינוס"} בכל אחד מהאיברים בתוך הסוגריים, כולל הסימנים.`));
    steps.push(st(L(total), 1, "אחרי הנשיקות"));
  } else if (level === 2) {
    // a(bx+c) ± d(ex+f)
    const a = rnz(-6, 6),
      d = rnz(-6, 6);
    const p1 = x.scale(rnz(-7, 7)).add(Poly.const(rnz(-9, 9)));
    const p2 = x.scale(rnz(-7, 7)).add(Poly.const(rnz(-9, 9)));
    const opened = p1.scale(a).add(p2.scale(d));
    total = opened;
    const dS = d < 0 ? `-${Math.abs(d) === 1 ? "" : Math.abs(d)}` : `+${d === 1 ? "" : d}`;
    const aS = a === -1 ? "-" : a === 1 ? "" : `${a}`;
    prompt = `${aS}\\left(${L(p1)}\\right)${dS}\\left(${L(p2)}\\right)`;
    plain = `(${a})*(${P(p1)})+(${d})*(${P(p2)})`;
    // trap: second parenthesis: sign not distributed
    if (d < 0) {
      const t = p2.orderedTerms();
      const wrong = p1.scale(a).add(Poly.term(F.mul(t[0].coef, frac(d)), t[0].mono)).add(Poly.term(F.mul(t[1].coef, frac(-d)), t[1].mono));
      traps.push({ plain: P(wrong), message: "המינוס שלפני הסוגריים השניים צריך להידבק גם לאיבר השני שם – הוא הופך את כולם." });
    }
    stages.push(
      S("נשיקה לכולם", "שני זוגות סוגריים – שני בחורים עם מגנטים. כל אחד נותן נשיקה לכל האיברים בסוגריים שלו. מינוס לפני סוגריים הופך את כולם.", "פתחי כל סוגריים בנפרד, וכתבי את כל ארבעת האיברים עם הסימנים הנכונים."),
      S("איחוד משפחות", "עכשיו יש חתולים ומספרים – כל אחד הולך עם המשפחה שלו.", `חברי את איברי ה-${v1} ביחד ואת המספרים ביחד.`)
    );
    steps.push(st(`${L(p1.scale(a))}${L(p2.scale(d)).startsWith("-") ? "" : "+"}${L(p2.scale(d))}`, 1, "אחרי פתיחת שני הסוגריים"), st(L(total), 2, "אחרי איחוד משפחות"));
    // when opened has like terms merged, first step latex may equal final; fine
  } else {
    // nested: -t(3t-(2y-2t))
    const outer = pick([x.neg(), x, Poly.const(-1), Poly.const(rnz(2, 4))]);
    const innerSmall = Poly.v(v2).scale(rnz(-4, 4)).add(x.scale(rnz(-5, 5)));
    const big = x.scale(rnz(2, 6)).sub(innerSmall);
    const afterSmall = big; // as poly
    total = outer.mul(big);
    const k = big.coeffOf(v1, 1).constValue().n + innerSmall.coeffOf(v1, 1).constValue().n; // original coefficient before subtracting inner
    const outerS = outer.isConst() ? (outer.constValue().n === -1 ? "-" : `${outer.constValue().n}`) : L(outer);
    prompt = `${outerS}\\left(${L(x.scale(k))}-\\left(${L(innerSmall)}\\right)\\right)`;
    plain = `(${P(outer)})*((${P(x.scale(k))})-(${P(innerSmall)}))`;
    stages.push(
      S("הילד הקטן קודם", "סוגריים בתוך סוגריים – כמו ללכת מכות עם שני ילדים: קודם מסתדרים עם הקטן (הפנימי).", "פתחי קודם את הסוגריים הפנימיים – המינוס שלפניהם הופך את כל מה שבפנים."),
      S("איחוד משפחות בפנים", "לפני שפותחים את הסוגריים הגדולים – אולי יש חתולים בפנים שאפשר לחבר?", `חברי את איברי ה-${v1} בתוך הסוגריים הגדולים.`),
      S("נשיקה לכולם", "מה שבחוץ הוא הבחור עם המגנטים – נותן נשיקה לכל איבר בסוגריים. קודם סימן, אז מספרים, אז נעלמים.", `כפלי את ${outerS || "מה שבחוץ"} בכל איבר.`)
    );
    steps.push(
      st(`${outerS}\\left(${L(x.scale(k))}${L(innerSmall.neg()).startsWith("-") ? "" : "+"}${L(innerSmall.neg())}\\right)`, 1, "פתחנו את הסוגריים הקטנים"),
      st(`${outerS}\\left(${L(afterSmall)}\\right)`, 2, "איחוד משפחות בפנים"),
      st(L(total), 3, "נשיקות מבחוץ")
    );
  }
  return {
    id: uid("dist"),
    typeId: "distribute",
    topicId: "parens",
    kind: "expr",
    level,
    instruction: "פתחי סוגריים ופשטי:",
    promptLatex: prompt,
    originalPlain: plain,
    finalPlain: P(total),
    finalLatex: L(total),
    finalForm: "expanded",
    stages,
    steps,
    stageOf: (info) => {
      if (!info.node) return 0;
      const pc = parenCount(info.node);
      if (level === 3) return pc >= 2 ? 0 : pc === 1 ? 1 : 2;
      if (level === 2) return pc > 0 ? 0 : 1;
      return 0;
    },
    traps,
  };
}

/* =====================================================================
   4. כפל סוגריים בסוגריים – (x+3)(x-7)
   ===================================================================== */
export function genBinomial(level: number): Exercise {
  const v = pick(["x", "a", "m"]);
  const x = Poly.v(v);
  const p1 = level === 1 ? x.add(Poly.const(rnz(-9, 9))) : x.scale(rnz(-5, 5)).add(Poly.const(rnz(-9, 9)));
  const p2 = level === 1 ? x.add(Poly.const(rnz(-9, 9))) : x.scale(rnz(-5, 5)).add(Poly.const(rnz(-9, 9)));
  const k = level === 3 ? rnz(-4, 4) : 1;
  const total = p1.mul(p2).scale(k);
  const kS = k === 1 ? "" : k === -1 ? "-" : `${k}`;
  const prompt = `${kS}\\left(${L(p1)}\\right)\\left(${L(p2)}\\right)`;
  const plain = `(${k})*(${P(p1)})*(${P(p2)})`;
  const traps: Trap[] = [];
  if (level === 1) {
    const a = p1.constValue(),
      b = p2.constValue();
    traps.push({ plain: P(x.pow(2).add(Poly.const(F.mul(a, b)))), message: "שכחת את האיברים האמצעיים! כל איבר בסוגריים הראשונים נותן נשיקה לכל איבר בשניים – 4 נשיקות." });
  }
  const stages: StageInfo[] = [
    S("נשיקה לכולם – 4 נשיקות", "כשיש שני זוגות סוגריים, כל איבר בראשון נותן נשיקה לכל איבר בשני. שני איברים כפול שני איברים = ארבע נשיקות.", `כתבי את ארבע המכפלות: ראשון·ראשון, ראשון·שני, שני·ראשון, שני·שני. קודם סימן!`),
    S("איחוד משפחות", "יש שני איברים מאותה משפחה (עם x בחזקת 1) – חתולים עם חתולים.", "חברי את שני איברי האמצע."),
  ];
  const opened = (() => {
    const t1 = p1.orderedTerms(),
      t2 = p2.orderedTerms();
    const parts: Poly[] = [];
    for (const a of t1) for (const b of t2) parts.push(Poly.term(a.coef, a.mono).mul(Poly.term(b.coef, b.mono)));
    return parts;
  })();
  let openedLatex = "";
  opened.forEach((p, i) => {
    const s = L(p);
    openedLatex += i === 0 ? s : s.startsWith("-") ? s : "+" + s;
  });
  const steps: Step[] = [];
  if (k !== 1) {
    stages.unshift(S("קודם שני הסוגריים", "יש שלושה גורמים. הכי נוח: קודם לכפול את שני הסוגריים ביניהם, ואת המספר שבחוץ לתת בסוף (הוא נשיקה קלה).", "כפלי את שני הסוגריים (4 נשיקות), ורק אז את המספר שבחוץ."));
    steps.push(st(`${kS}\\left(${openedLatex}\\right)`, 1, "4 נשיקות"), st(`${kS}\\left(${L(p1.mul(p2))}\\right)`, 2, "איחוד משפחות בפנים"), st(L(total), 3, "המספר שבחוץ נותן נשיקה"));
  } else {
    steps.push(st(openedLatex, 1, "4 נשיקות"), st(L(total), 2, "איחוד משפחות"));
  }
  return {
    id: uid("bin"),
    typeId: "binomial",
    topicId: "parens",
    kind: "expr",
    level,
    instruction: "פתחי סוגריים ופשטי:",
    promptLatex: prompt,
    originalPlain: plain,
    finalPlain: P(total),
    finalLatex: L(total),
    finalForm: "expanded",
    stages,
    steps,
    stageOf: (info) => (info.node && parenCount(info.node) > 0 ? 0 : stages.length - 1),
    traps,
  };
}

/* =====================================================================
   5. הוצאת גורם משותף
   ===================================================================== */
export function genCommonFactor(level: number): Exercise {
  const [v1, v2] = pick(VARS2);
  const g = level === 1 ? pick([2, 3, 5, 7, 11]) : pick([2, 3, 4, 5, 6]);
  const gMono = level === 1 ? Poly.const(g) : level === 2 ? Poly.v(v1, 1, g) : Poly.v(v1, rint(1, 3), g);
  const nTerms = level === 3 ? 3 : 2;
  const rest: Poly[] = [];
  const kinds = level === 1 ? [Poly.v(v1), Poly.v(v2), Poly.const(1)] : [Poly.v(v1), Poly.v(v2), Poly.const(1), Poly.v(v1, 2)];
  const used = new Set<string>();
  while (rest.length < nTerms) {
    const k = pick(kinds);
    const key = P(k);
    if (used.has(key)) continue;
    used.add(key);
    let c = rnz(-9, 9);
    // make sure gcd of coefficients stays 1
    rest.push(k.scale(c));
    void c;
  }
  // ensure inner content is 1
  let inner = rest.reduce((a, b) => a.add(b), Poly.zero());
  const cont = inner.content();
  if (cont > 1) inner = inner.scale(frac(1, cont));
  // ensure inner has no common variable
  const mg = inner.monoGcd();
  if (Object.keys(mg).length) inner = inner.divideByMono(mg);
  // ensure at least one term positive leading
  const total = gMono.mul(inner);
  const finalLatex = `${L(gMono)}\\left(${L(inner)}\\right)`;
  const finalPlain = `(${P(gMono)})*(${P(inner)})`;
  const stages: StageInfo[] = [
    S("ועד בית קומוניסטי", "הוועד עובר דירה-דירה ולוקח מכולם *אותו דבר* – הכי הרבה שכולם יכולים לתת. גם מספר וגם נעלם.", `בדקי: איזה מספר מחלק את כל המקדמים? האם ${v1} מופיע בכל האיברים? זה הגורם המשותף.`),
    S("מה נשאר בסוגריים", "אחרי שהוועד לקח – מה נשאר לכל דירה? אם לא נשאר כלום – נשאר 1 לזכרו! בדיקה: פתחי חזרה סוגריים ותקבלי את המקור.", `כתבי גורם משותף · (מה שנשאר מכל איבר). אל תשכחי 1 אם איבר 'התרוקן'.`),
  ];
  const traps: Trap[] = [];
  return {
    id: uid("cf"),
    typeId: "common_factor",
    topicId: "common_factor",
    kind: "expr",
    level,
    instruction: "הוציאי גורם משותף (פרקי לגורמים):",
    promptLatex: L(total),
    originalPlain: P(total),
    finalPlain,
    finalLatex,
    finalForm: "factored",
    stages,
    steps: [st(finalLatex, 2, "הוועד לקח, ובסוגריים מה שנשאר")],
    stageOf: (info) => (info.node && parenCount(info.node) > 0 ? 1 : 0),
    traps,
  };
}

/* =====================================================================
   6. צמצום שבר בעזרת גורם משותף (כולל חיסור הפוך)
   ===================================================================== */
export function genFractionCF(level: number): Exercise {
  const v = pick(["x", "c", "b", "a"]);
  const x = Poly.v(v);
  let num: Poly, den: Poly, finalLatex: string, finalPlain: string, promptLatex: string;
  const traps: Trap[] = [];
  const stages: StageInfo[] = [
    S("ועד בית – למעלה ולמטה בנפרד", "אסור לצמצם כשיש חיבור/חיסור! קודם הוועד הקומוניסטי מוציא גורם משותף מהמונה, ובנפרד מהמכנה.", `הוציאי גורם משותף מהמונה (מה מחלק את כל האיברים למעלה?) ואם צריך גם מהמכנה.`),
    S("פלאש-דאון", "עכשיו יש כפל של גושים – מותר לצמצם גוש שלם למעלה עם גוש שלם למטה. מושכים בידית!", "צמצמי את הגושים הזהים למעלה ולמטה, וכתבי מה שנשאר."),
  ];
  const steps: Step[] = [];
  if (level === 1) {
    // (ax + b)/k with k | a and k | b  -> polynomial
    const k = pick([2, 3, 4, 5, 10]);
    const q = x.scale(rnz(1, 6)).add(Poly.const(rnz(-9, 9)));
    num = q.scale(k);
    den = Poly.const(k);
    finalLatex = L(q);
    finalPlain = P(q);
    promptLatex = `\\frac{${L(num)}}{${k}}`;
    const t = num.orderedTerms();
    traps.push({ plain: `${P(Poly.term(F.div(t[0].coef, frac(k)), t[0].mono))}+(${P(Poly.term(t[1].coef, t[1].mono))})`, message: "אסור לצמצם רק איבר אחד כשיש חיבור! צריך לחלק *כל* איבר ב-" + k + " (או להוציא גורם משותף)." });
    steps.push(st(`\\frac{${k}\\left(${L(q)}\\right)}{${k}}`, 1, "הוועד הוציא " + k), st(finalLatex, 2, "פלאש-דאון"));
  } else if (level === 2) {
    // (a x^2 + b x)/(c x + d) with common factor structure: (m*x*(px+q))/(n*(px+q))
    const inner = x.scale(rnz(1, 5)).add(Poly.const(rnz(-9, 9)));
    const m = rnz(1, 6),
      n = rnz(1, 6);
    num = inner.mul(Poly.v(v, 1, m));
    den = inner.scale(n);
    const g = gcd(m, n);
    const fm = m / g,
      fn = n / g;
    finalLatex = fn === 1 ? L(Poly.v(v, 1, fm)) : `\\frac{${L(Poly.v(v, 1, fm))}}{${fn}}`;
    finalPlain = `(${fm}*${v})/${fn}`;
    promptLatex = `\\frac{${L(num)}}{${L(den)}}`;
    steps.push(st(`\\frac{${m}${v}\\left(${L(inner)}\\right)}{${n}\\left(${L(inner)}\\right)}`, 1, "ועד בית למעלה ולמטה"), st(finalLatex, 2, "פלאש-דאון"));
  } else {
    // חיסור הפוך: (a x^2 - a x)/(b - b x) = -a x / b   ; num = a x (x-1), den = b(1-x)
    const a = rnz(1, 6),
      b = pick([2, 3, 4, 5, 6]);
    const c = rint(1, 5);
    const inner = x.sub(Poly.const(c)); // x - c
    num = inner.mul(Poly.v(v, 1, a)); // a x^2 - a c x
    den = inner.neg().scale(b); // b c - b x
    const g = gcd(a, b);
    const fa = a / g,
      fb = b / g;
    finalLatex = fb === 1 ? L(Poly.v(v, 1, -fa)) : `-\\frac{${L(Poly.v(v, 1, fa))}}{${fb}}`;
    finalPlain = `-(${fa}*${v})/${fb}`;
    promptLatex = `\\frac{${L(num)}}{${L(den)}}`;
    stages.push(S("חיסור הפוך", "למעלה יש (x−c) ולמטה (c−x) – זה חיסור הפוך: אותו הפרש מנקודת מבט הפוכה. מספר חלקי המינוס שלו = −1.", "הוציאי מינוס מהסוגריים במכנה (או במונה) כדי שהגושים יהיו זהים – ואז צמצמי; נשאר מינוס."));
    steps.push(
      st(`\\frac{${a}${v}\\left(${L(inner)}\\right)}{${b}\\left(${L(inner.neg())}\\right)}`, 1, "ועד בית למעלה ולמטה"),
      st(`\\frac{${a}${v}\\left(${L(inner)}\\right)}{-${b}\\left(${L(inner)}\\right)}`, 2, "חיסור הפוך – הוצאנו מינוס"),
      st(finalLatex, 3, "פלאש-דאון")
    );
    traps.push({ plain: `(${a}*${v})/${b}`, message: "שכחת את המינוס של חיסור הפוך: (x−c) חלקי (c−x) זה −1, לא 1." });
  }
  return {
    id: uid("frac"),
    typeId: "fraction_cf",
    topicId: "common_factor",
    kind: "expr",
    level,
    instruction: "צמצמי את השבר ככל האפשר:",
    promptLatex,
    originalPlain: `(${P(num)})/(${P(den)})`,
    finalPlain,
    finalLatex,
    finalForm: "any",
    stages,
    steps,
    stageOf: (info) => (info.node && parenCount(info.node) > 0 ? 1 : 0),
    traps,
  };
}

/* =====================================================================
   7. משוואה עם נעלם אחד
   ===================================================================== */
export function genLinearEq(level: number): Exercise {
  const v = "x";
  const x = Poly.v(v);
  const sol = rnz(-9, 9);
  let lhs: Poly, rhs: Poly, promptLatex: string;
  let solutions: number[] | "all" | "none" = [sol];
  const stages: StageInfo[] = [];
  const steps: Step[] = [];
  const traps: Trap[] = [];
  const mapTags: Partial<Record<EqTag, number>> = {};

  if (level === 1) {
    // ax + b = c
    const a = pick([2, 3, 4, 5, 6, 7]),
      b = rnz(-15, 15);
    lhs = x.scale(a).add(Poly.const(b));
    rhs = Poly.const(a * sol + b);
    promptLatex = `${L(lhs)}=${L(rhs)}`;
    stages.push(
      S("ליברמן – להפריד", "נעלמים בצד אחד, מספרים בצד שני. מה שעובר צד – עובר דרך מראת הקסמים ומתהפך (+ ↔ −).", `העבירי את ${b >= 0 ? b : `(${b})`} לצד השני – הוא ${b >= 0 ? "פלוס, אז יהפוך למינוס" : "מינוס, אז יהפוך לפלוס"}.`),
      S("חילוק במקדם", `כמה שווה פרה אחת? יש ${Math.abs(a)} פרות. כפל עובר צד והופך לחילוק.`, `חלקי את שני הצדדים ב-${a}.`)
    );
    mapTags.families = 0;
    mapTags.divide = 1;
    mapTags.final = 2;
    steps.push(st(`${L(x.scale(a))}=${L(rhs.sub(Poly.const(b)))}`, 1, "ליברמן"), st(`x=${sol}`, 2, "חילוק במקדם"));
  } else if (level === 2) {
    // a(x + b) = c + d x   or  ax + b = cx + d
    const variant = pick([0, 1]);
    if (variant === 0) {
      const a = rnz(-5, 5),
        b = rnz(-9, 9),
        d = rnz(-5, 5);
      if (d === a) return genLinearEq(level);
      lhs = x.add(Poly.const(b)).scale(a);
      const c = a * (sol + b) - d * sol;
      rhs = Poly.const(c).add(x.scale(d));
      promptLatex = `${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(b)))}\\right)=${L(rhs)}`;
      stages.push(S("נשיקה לכולם", "יש סוגריים – הבחור עם המגנטים נותן נשיקה לכל איבר בפנים.", `כפלי את ${a} בכל איבר בסוגריים.`));
      mapTags.parens = 0;
      steps.push(st(`${L(lhs)}=${L(rhs)}`, 1, "פתחנו סוגריים"));
    } else {
      const a = rnz(-7, 7),
        c = rnz(-7, 7);
      if (a === c) return genLinearEq(level);
      const b = rnz(-15, 15);
      lhs = x.scale(a).add(Poly.const(b));
      const d = a * sol + b - c * sol;
      rhs = x.scale(c).add(Poly.const(d));
      promptLatex = `${L(lhs)}=${L(rhs)}`;
    }
    const idx = stages.length;
    stages.push(
      S("ליברמן + שונא שליליים", "נעלמים לצד אחד, מספרים לצד שני. איזה צד? הצד שבו האיקסים יצאו *חיוביים* – שונא שליליים יחיה!", "העבירי את האיקסים לצד שבו יש יותר איקסים, ואת המספרים לצד השני. מה שעובר – מתהפך."),
      S("איחוד משפחות", "חתולים עם חתולים, מספרים עם מספרים.", "חברי את האיקסים ואת המספרים בכל צד."),
      S("חילוק במקדם", "כפל עובר צד והופך לחילוק.", "חלקי את שני הצדדים במקדם של x.")
    );
    mapTags.liberman = idx;
    mapTags.families = idx + 1;
    mapTags.divide = idx + 2;
    mapTags.final = idx + 3;
    const la = lhs.coeffOf(v, 1).constValue().n,
      ra = rhs.coeffOf(v, 1).constValue().n;
    const lb = lhs.constValue().n,
      rb = rhs.constValue().n;
    const left = la >= ra;
    const coef = left ? la - ra : ra - la;
    const cst = left ? rb - lb : lb - rb;
    steps.push(st(left ? `${L(x.scale(la))}${L(x.scale(-ra)).startsWith("-") ? "" : "+"}${L(x.scale(-ra))}=${rb}${lb > 0 ? "-" + lb : "+" + -lb}` : `${lb}${rb > 0 ? "-" + rb : "+" + -rb}=${L(x.scale(ra))}${L(x.scale(-la)).startsWith("-") ? "" : "+"}${L(x.scale(-la))}`, idx + 1, "ליברמן"), st(left ? `${L(x.scale(coef))}=${cst}` : `${cst}=${L(x.scale(coef))}`, idx + 2, "איחוד משפחות"), st(`x=${sol}`, idx + 3, "חילוק במקדם"));
  } else {
    // level 3: parens on both sides, maybe "all"/"none"
    const special = Math.random() < 0.3 ? pick(["all", "none"] as const) : null;
    const a = rnz(-5, 5),
      b = rnz(-6, 6),
      c = rnz(-5, 5),
      d = rnz(-6, 6);
    lhs = x.add(Poly.const(b)).scale(a).add(Poly.const(rnz(-9, 9)));
    if (special === "all") {
      rhs = lhs.clone();
      // rewrite rhs differently: c(x+d)+e where c=a, e chosen so equal
      const e = lhs.constValue().n - a * d;
      rhs = x.add(Poly.const(d)).scale(a).add(Poly.const(e));
      solutions = "all";
      promptLatex = `${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(b)))}\\right)${fracLatex(lhs.constValue(), { forceSign: true })}=${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(d)))}\\right)${fracLatex(frac(e), { forceSign: true })}`;
    } else if (special === "none") {
      const e = lhs.constValue().n - a * d + rnz(1, 5);
      rhs = x.add(Poly.const(d)).scale(a).add(Poly.const(e));
      solutions = "none";
      promptLatex = `${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(b)))}\\right)${fracLatex(lhs.constValue(), { forceSign: true })}=${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(d)))}\\right)${fracLatex(frac(e), { forceSign: true })}`;
    } else {
      if (c === a) return genLinearEq(level);
      const e = lhs.evaluate({ x: sol }) - c * (sol + d);
      rhs = x.add(Poly.const(d)).scale(c).add(Poly.const(e));
      promptLatex = `${a === -1 ? "-" : a}\\left(${L(x.add(Poly.const(b)))}\\right)${fracLatex(lhs.constValue(), { forceSign: true })}=${c === -1 ? "-" : c}\\left(${L(x.add(Poly.const(d)))}\\right)${fracLatex(frac(e), { forceSign: true })}`;
    }
    stages.push(
      S("נשיקה לכולם", "סוגריים בשני הצדדים – שני בחורים עם מגנטים. כל אחד נותן נשיקה בסוגריים שלו.", "פתחי את הסוגריים בשני הצדדים."),
      S("איחוד משפחות בכל צד", "לפני שמעבירים – חתולים עם חתולים בכל צד בנפרד.", "חברי מספרים עם מספרים בכל צד."),
      S("ליברמן + שונא שליליים", "נעלמים לצד אחד, מספרים לצד שני; האיקסים לצד שבו יצאו חיוביים.", "העבירי צדדים. אם האיקסים נעלמים משני הצדדים – בדקי מה נשאר: 0=0 → כל x; מספר≠מספר → אין x."),
      S("חילוק במקדם", "כפל עובר צד והופך לחילוק.", "חלקי במקדם של x.")
    );
    mapTags.parens = 0;
    mapTags.families = 1;
    mapTags.liberman = 2;
    mapTags.divide = 3;
    mapTags.final = 4;
    steps.push(st(`${L(lhs)}=${L(rhs)}`, 2, "פתחנו סוגריים ואיחדנו משפחות"));
    if (solutions === "all") steps.push(st(`0=0`, 3, "הכול התקזז – כל x!"));
    else if (solutions === "none") steps.push(st(`${L(Poly.const(lhs.constValue()))}=${L(Poly.const(rhs.constValue()))}`, 3, "האיקסים נעלמו ונשאר שוויון לא נכון – אין x"));
    else {
      const la = lhs.coeffOf(v, 1).constValue().n,
        ra = rhs.coeffOf(v, 1).constValue().n;
      const lb = lhs.constValue().n,
        rb = rhs.constValue().n;
      const left = la >= ra;
      const coef = left ? la - ra : ra - la;
      const cst = left ? rb - lb : lb - rb;
      steps.push(st(left ? `${L(x.scale(coef))}=${cst}` : `${cst}=${L(x.scale(coef))}`, 3, "ליברמן"), st(`x=${sol}`, 4, "חילוק במקדם"));
    }
  }
  return {
    id: uid("lin"),
    typeId: "linear_eq",
    topicId: "linear_eq",
    kind: "equation",
    level,
    instruction: "פתרי את המשוואה:",
    promptLatex,
    finalLatex: solutions === "all" ? "\\text{כל } x" : solutions === "none" ? "\\text{אין פתרון}" : `x=${sol}`,
    variable: v,
    solutions,
    stages,
    steps,
    stageOf: eqStageOf(mapTags, v),
    traps,
  };
}

/* =====================================================================
   8. משוואות עם שברים – תנועות הריקוד
   ===================================================================== */
export function genLinearEqFrac(level: number): Exercise {
  const v = "x";
  const x = Poly.v(v);
  const sol = rnz(-8, 8);
  let promptLatex: string;
  const stages: StageInfo[] = [
    S("שונא שברים יחיה – טרומפלדור / קונגפו פנדה", "לפני הכול נפטרים מהשברים: מוצאים מכנה משותף (קונגפו פנדה) ומכפילים *כל גוש* במשוואה בו – כפל טרומפלדור. זוכרים: קודם לצמצם (תנועת ראש), ורק אז לרקוד דיסקו.", "מצאי מכנה משותף לכל השברים והכפילי כל גוש בו – גם את הגושים בלי שבר!"),
    S("נשיקה לכולם", "אחרי הטרומפלדור נשארו סוגריים – הבחור עם המגנטים.", "פתחי את הסוגריים."),
    S("ליברמן + איחוד משפחות", "נעלמים בצד אחד, מספרים בצד שני, ואז חתולים עם חתולים.", "העבירי צדדים וחברי."),
    S("חילוק במקדם", "כפל עובר צד והופך לחילוק.", "חלקי במקדם של x."),
  ];
  const steps: Step[] = [];
  const traps: Trap[] = [];
  let lhsStr: string, rhsStr: string;
  if (level === 1) {
    // x/a + b = c
    const a = pick([2, 3, 4, 5]);
    const b = rnz(-9, 9);
    const c = sol / a + b;
    // ensure integer: choose sol multiple of a
    const s2 = a * rnz(-5, 5);
    const c2 = s2 / a + b;
    promptLatex = `\\frac{x}{${a}}${b < 0 ? "-" + -b : "+" + b}=${c2}`;
    lhsStr = `x/${a}+(${b})`;
    rhsStr = `${c2}`;
    void c;
    steps.push(st(`x+${a * b}=${a * c2}`.replace("+-", "-"), 1, "טרומפלדור: הכפלנו הכול ב-" + a), st(`x=${s2}`, 3, "ליברמן"));
    return {
      id: uid("linf"),
      typeId: "linear_eq_frac",
      topicId: "linear_eq_frac",
      kind: "equation",
      level,
      instruction: "פתרי את המשוואה:",
      promptLatex,
      finalLatex: `x=${s2}`,
      variable: v,
      solutions: [s2],
      stages,
      steps,
      stageOf: eqStageOf({ fractions: 0, parens: 1, liberman: 2, families: 2, divide: 3, final: 4 }, v),
      traps,
    };
  }
  if (level === 2) {
    // (ax+b)/c = (dx+e)/f  with integer solution
    const c = pick([2, 3, 4, 6]),
      f = pick([2, 3, 5, 6]);
    if (c === f) return genLinearEqFrac(level);
    const a = rnz(1, 5),
      d = rnz(1, 5);
    const b = rnz(-9, 9);
    // f(ax+b) = c(dx+e) → e = (f(a sol + b) - c d sol)/c must be integer: choose sol multiple of c
    const s2 = c * rnz(-3, 3) || c;
    const eNum = f * (a * s2 + b) - c * d * s2;
    if (eNum % c !== 0 || f * a === c * d) return genLinearEqFrac(level);
    const e = eNum / c;
    const p1 = x.scale(a).add(Poly.const(b)),
      p2 = x.scale(d).add(Poly.const(e));
    promptLatex = `\\frac{${L(p1)}}{${c}}=\\frac{${L(p2)}}{${f}}`;
    lhsStr = `(${P(p1)})/${c}`;
    rhsStr = `(${P(p2)})/${f}`;
    const lcm = (c * f) / gcd(c, f);
    steps.push(st(`${lcm / c}\\left(${L(p1)}\\right)=${lcm / f}\\left(${L(p2)}\\right)`, 1, `הכפלנו הכול ב-${lcm} (טרומפלדור)`), st(`${L(p1.scale(lcm / c))}=${L(p2.scale(lcm / f))}`, 2, "נשיקות"), st(`x=${s2}`, 4, "ליברמן וחילוק"));
    traps.push({ plain: `x`, message: "" });
    traps.length = 0;
    return {
      id: uid("linf"),
      typeId: "linear_eq_frac",
      topicId: "linear_eq_frac",
      kind: "equation",
      level,
      instruction: "פתרי את המשוואה:",
      promptLatex,
      finalLatex: `x=${s2}`,
      variable: v,
      solutions: [s2],
      stages,
      steps,
      stageOf: eqStageOf({ fractions: 0, parens: 1, liberman: 2, families: 2, divide: 3, final: 4 }, v),
      traps,
    };
  }
  // level 3: (ax+b)/c + (dx+e)/f = g x  or = number
  const c = pick([2, 3, 4]),
    f = pick([3, 5, 6]);
  if (c === f) return genLinearEqFrac(level);
  const lcm = (c * f) / gcd(c, f);
  const a = rnz(1, 5),
    d = rnz(1, 5),
    b = rnz(-9, 9);
  const s2 = lcm * rnz(-2, 2) || lcm;
  const g = rnz(-3, 3);
  // (lcm/c)(a s + b) + (lcm/f)(d s + e) = lcm g s
  const mc = lcm / c,
    mf = lcm / f;
  const eNum = lcm * g * s2 - mc * (a * s2 + b) - mf * d * s2;
  if (eNum % mf !== 0 || mc * a + mf * d === lcm * g) return genLinearEqFrac(level);
  const e = eNum / mf;
  const p1 = x.scale(a).add(Poly.const(b)),
    p2 = x.scale(d).add(Poly.const(e));
  promptLatex = `\\frac{${L(p1)}}{${c}}+\\frac{${L(p2)}}{${f}}=${L(x.scale(g))}`;
  lhsStr = `(${P(p1)})/${c}+(${P(p2)})/${f}`;
  rhsStr = `${g}*x`;
  void lhsStr;
  void rhsStr;
  steps.push(st(`${mc}\\left(${L(p1)}\\right)+${mf}\\left(${L(p2)}\\right)=${L(x.scale(g * lcm))}`, 1, `הכפלנו הכול ב-${lcm}`), st(`${L(p1.scale(mc).add(p2.scale(mf)))}=${L(x.scale(g * lcm))}`, 2, "נשיקות ואיחוד משפחות"), st(`x=${s2}`, 4, "ליברמן וחילוק"));
  return {
    id: uid("linf"),
    typeId: "linear_eq_frac",
    topicId: "linear_eq_frac",
    kind: "equation",
    level,
    instruction: "פתרי את המשוואה:",
    promptLatex,
    finalLatex: `x=${s2}`,
    variable: v,
    solutions: [s2],
    stages,
    steps,
    stageOf: eqStageOf({ fractions: 0, parens: 1, liberman: 2, families: 2, divide: 3, final: 4 }, v),
    traps,
  };
}

/* =====================================================================
   9. שתי משוואות – גולאג וקרמבו
   ===================================================================== */
export function genSystem(level: number): Exercise {
  const x0 = rnz(-6, 6),
    y0 = rnz(-6, 6);
  let a1: number, b1: number, a2: number, b2: number;
  if (level === 1) {
    a1 = rnz(1, 5);
    a2 = rnz(1, 5);
    b1 = pick([1, -1, 2, -2, 3]);
    b2 = pick([b1, -b1]);
    if (a1 === a2 && b1 === b2) a2 = a1 + 1;
  } else if (level === 2) {
    a1 = rnz(1, 5);
    a2 = rnz(1, 5);
    b1 = pick([1, -1, 2, -2]);
    b2 = b1 * pick([2, 3, -2, -3]);
  } else {
    a1 = rnz(2, 5);
    a2 = rnz(2, 5);
    b1 = pick([2, 3, -2, -3]);
    b2 = pick([3, 5, -3, -5, 4]);
    if (Math.abs(b2) === Math.abs(b1)) b2 += 1;
  }
  if (a1 * b2 - a2 * b1 === 0) return genSystem(level);
  const c1 = a1 * x0 + b1 * y0,
    c2 = a2 * x0 + b2 * y0;
  const x = Poly.v("x"),
    y = Poly.v("y");
  const e1 = x.scale(a1).add(y.scale(b1)),
    e2 = x.scale(a2).add(y.scale(b2));
  const promptLatex = `\\begin{cases}${L(e1)}=${c1}\\\\${L(e2)}=${c2}\\end{cases}`;
  const askBoth = level >= 2 || Math.random() < 0.5;
  const stages: StageInfo[] = [
    S("סובייטים מסודרים", "לפני הגולאג – מסדרים: x מתחת ל-x, y מתחת ל-y, מספרים מתחת למספרים.", "ודאי ששתי המשוואות מסודרות באותו סדר: ax + by = c."),
    S("סטאלין: יש נעלם – יש בעיה", `אנחנו רוצים את x, אז y הוא הבעיה. איך מחסלים? חיבור או חיסור משוואות. אם המקדמים של y לא שווים – עבודת הכנה: מכפילים משוואה שלמה.`, level === 1 ? "המקדמים של y כבר שווים בגודלם – אפשר לחסל ישר." : "הכפילי משוואה אחת (את כולה! גם הצד הימני) כך שהמקדמים של y יהיו שווים בגודלם."),
    S("לחבר או לחסר?", "סימנים הפוכים (+y ו−y) → מחברים, הכנופיות נפגשות ומחסלות. אותו סימן → מחסרים (שמים סכין ביניהם). לא בטוחה? נסי חיבור, ואם y לא נעלם – חיסור.", "חברי/חסרי את המשוואות שורה-שורה. y חייב להיעלם."),
    S("פותרים נעלם אחד", "נשארה משוואה רגילה עם x – ליברמן וחילוק.", "פתרי את x."),
    S("קרמבו למציאת השני", "עכשיו שיודעים את x – מציבים במשוואה (בסוגריים!) ומוצאים y. או גולאג נוסף.", "הציבי את x באחת המשוואות המקוריות ומצאי את y."),
  ];
  const mult = level === 1 ? 1 : Math.abs(b2 / b1);
  const e1m = e1.scale(mult),
    c1m = c1 * mult;
  const same = Math.sign(b1 * mult) === Math.sign(b2);
  const combined = same ? e2.sub(e1m) : e2.add(e1m);
  const cc = same ? c2 - c1m : c2 + c1m;
  const steps: Step[] = [];
  if (mult !== 1) steps.push(st(`${L(e1m)}=${c1m}`, 1, `הכפלנו את המשוואה הראשונה ב-${mult}`));
  steps.push(st(`${L(combined)}=${cc}`, 2, same ? "חיסרנו – y חוסל" : "חיברנו – y חוסל"), st(`x=${x0}`, 3, "חילוק במקדם"));
  if (askBoth) steps.push(st(`y=${y0}`, 4, "הצבה (קרמבו) במשוואה מקורית"));
  return {
    id: uid("sys"),
    typeId: "system",
    topicId: "systems",
    kind: "system",
    level,
    instruction: askBoth ? "פתרי את מערכת המשוואות (מצאי x ו-y):" : "מצאי את x:",
    promptLatex,
    finalLatex: askBoth ? `x=${x0},\\ y=${y0}` : `x=${x0}`,
    vars: ["x", "y"],
    solutionMap: { x: x0, y: y0 },
    askFor: askBoth ? ["x", "y"] : ["x"],
    stages,
    steps,
    stageOf: (info) => {
      if (!info.lhs || !info.rhs) return 0;
      const vs = new Set([...nodeVars(info.lhs), ...nodeVars(info.rhs)]);
      if (vs.size === 2) return 2;
      if (vs.size === 1) return 3;
      return 0;
    },
    traps: [],
  };
}

/* =====================================================================
   10. כפל מקוצר
   ===================================================================== */
export function genShortMult(level: number): Exercise {
  const v = pick(["x", "a", "b"]);
  const x = Poly.v(v);
  const traps: Trap[] = [];
  let prompt: string, plain: string, total: Poly;
  const stages: StageInfo[] = [
    S("האצבע", "(a+b)²: מסתירים את b עם האצבע → a². מרימים את האצבע → כפליים a·b. מסתירים את a → b². שלושה איברים תמיד!", "כתבי: (ראשון)² ± 2·ראשון·שני + (שני)²."),
    S("איחוד משפחות", "אם יש עוד איברים – חתולים עם חתולים.", "חברי איברים דומים."),
  ];
  const steps: Step[] = [];
  if (level === 1) {
    const a = rnz(-9, 9);
    const sq = x.add(Poly.const(a));
    total = sq.pow(2);
    prompt = `\\left(${L(sq)}\\right)^{2}`;
    plain = `(${P(sq)})^2`;
    traps.push({ plain: P(x.pow(2).add(Poly.const(a * a))), message: "חסר האיבר האמצעי! כשמרימים את האצבע מקבלים 2·x·" + a + ". (a+b)² הוא לא a²+b²." });
    steps.push(st(L(total), 1, "האצבע: ראשון², 2·ראשון·שני, שני²"));
  } else if (level === 2) {
    const k = rnz(2, 6),
      a = rnz(-9, 9);
    const sq = pick([x.scale(k).add(Poly.const(a)), Poly.const(a).add(x.scale(k))]);
    total = sq.pow(2);
    prompt = `\\left(${L(sq)}\\right)^{2}`;
    plain = `(${P(sq)})^2`;
    traps.push({ plain: P(x.pow(2).scale(k).add(x.scale(2 * k * a)).add(Poly.const(a * a))), message: `(${k}${v})² זה ${k * k}${v}² – גם המקדם עולה בריבוע.` });
    steps.push(st(L(total), 1, "האצבע"));
  } else {
    // 3(2+x)^2 - 10x  or (x+1)^2 + 2x - x^2 or (a-2)^2 - 5a
    const a = rnz(-6, 6),
      k = pick([1, 2, 3, -2, 5]);
    const sq = x.add(Poly.const(a));
    const extra = pick([x.scale(rnz(-10, 10)), x.scale(rnz(-9, 9)).add(x.pow(2).scale(-k)), Poly.const(rnz(-9, 9))]);
    total = sq.pow(2).scale(k).add(extra);
    const kS = k === 1 ? "" : k === -1 ? "-" : `${k}`;
    prompt = `${kS}\\left(${L(sq)}\\right)^{2}${L(extra).startsWith("-") ? "" : "+"}${L(extra)}`;
    plain = `(${k})*(${P(sq)})^2+(${P(extra)})`;
    steps.push(st(`${kS}\\left(${L(sq.pow(2))}\\right)${L(extra).startsWith("-") ? "" : "+"}${L(extra)}`, 1, "האצבע"), st(L(total), 2, "נשיקה מבחוץ + איחוד משפחות"));
    stages.splice(1, 0, S("נשיקה לכולם", "המספר שבחוץ נותן נשיקה לכל שלושת האיברים.", "כפלי את המקדם בכל איבר."));
  }
  return {
    id: uid("sm"),
    typeId: "short_mult",
    topicId: "short_mult",
    kind: "expr",
    level,
    instruction: "פתחי סוגריים לפי נוסחאות הכפל המקוצר ופשטי:",
    promptLatex: prompt,
    originalPlain: plain,
    finalPlain: P(total),
    finalLatex: L(total),
    finalForm: "expanded",
    stages,
    steps,
    stageOf: (info) => (info.node && parenCount(info.node) > 0 ? 0 : stages.length - 1),
    traps,
  };
}

/* =====================================================================
   11. פירוק טרינום / הפרש ריבועים
   ===================================================================== */
export function genTrinomial(level: number): Exercise {
  const v = pick(["x", "a", "y"]);
  const x = Poly.v(v);
  if (level === 3 && Math.random() < 0.5) {
    // difference of squares: k²x² - m²  or x² - m²
    const k = pick([1, 1, 2, 3, 4, 5]),
      m = rint(1, 9);
    const p1 = x.scale(k).add(Poly.const(m)),
      p2 = x.scale(k).sub(Poly.const(m));
    const total = p1.mul(p2);
    return {
      id: uid("ds"),
      typeId: "trinomial",
      topicId: "factoring",
      kind: "expr",
      level,
      instruction: "פרקי לגורמים:",
      promptLatex: L(total),
      originalPlain: P(total),
      finalPlain: `(${P(p1)})*(${P(p2)})`,
      finalLatex: `\\left(${L(p1)}\\right)\\left(${L(p2)}\\right)`,
      finalForm: "factored",
      stages: [
        S("התאומים ההפוכים", "שני איברים, שניהם ריבועים, ומינוס ביניהם = הפרש ריבועים. a²−b² = (a+b)(a−b): אותם אנשים, סימן הפוך – האמצע מתחסל כמו כנופיות.", `מה בריבוע נותן ${L(x.scale(k).pow(2))}? ומה בריבוע נותן ${m * m}? כתבי (א+ב)(א−ב).`),
      ],
      steps: [st(`\\left(${L(p1)}\\right)\\left(${L(p2)}\\right)`, 1, "תאומים הפוכים")],
      stageOf: () => 0,
      traps: [],
    };
  }
  const p = level === 1 ? rint(1, 9) : rnz(-9, 9),
    q = level === 1 ? rint(1, 9) : rnz(-9, 9);
  if (p === q && level > 1 && Math.random() < 0.7) return genTrinomial(level);
  const f1 = x.add(Poly.const(p)),
    f2 = x.add(Poly.const(q));
  const total = f1.mul(f2);
  return {
    id: uid("tri"),
    typeId: "trinomial",
    topicId: "factoring",
    kind: "expr",
    level,
    instruction: "פרקי לגורמים:",
    promptLatex: L(total),
    originalPlain: P(total),
    finalPlain: `(${P(f1)})*(${P(f2)})`,
    finalLatex: `\\left(${L(f1)}\\right)\\left(${L(f2)}\\right)`,
    finalForm: "factored",
    stages: [
      S("זוג שמסתדר", `מחפשים שני מספרים ש*במכפלה* נותנים ${p * q} ו*בסכום* נותנים ${p + q}. קודם המכפלה (מי המועמדים), אחר-כך הסכום (מי מתחתן עם מי). שימי לב לסימנים!`, `הזוג הוא ${p} ו-${q}. בדקי: ${p}·${q}=${p * q}, ${p}+${q}=${p + q}.`),
      S("כתיבת הסוגריים", "כל אחד מבני הזוג נכנס לסוגריים משלו עם x. בדיקה: פתחי חזרה (4 נשיקות) ותקבלי את המקור.", `כתבי (${v}${p >= 0 ? "+" : ""}${p})(${v}${q >= 0 ? "+" : ""}${q}).`),
    ],
    steps: [st(`\\left(${L(f1)}\\right)\\left(${L(f2)}\\right)`, 2, "הזוג שמסתדר")],
    stageOf: () => 0,
    traps: [],
  };
}

/* =====================================================================
   12. משוואות ריבועיות – אפס מאפס
   ===================================================================== */
export function genQuadraticEq(level: number): Exercise {
  const v = "x";
  const x = Poly.v(v);
  let lhs: Poly, roots: number[], stages: StageInfo[], steps: Step[], promptLatex: string;
  if (level === 1) {
    // x² + bx = 0  → x(x+b)=0
    const b = rnz(-12, 12);
    lhs = x.pow(2).add(x.scale(b));
    roots = [0, -b];
    promptLatex = `${L(lhs)}=0`;
    stages = [
      S("ועד בית", "שני איברים, לשניהם יש x – הוועד הקומוניסטי מוציא x החוצה.", `כתבי x(x${b >= 0 ? "+" : ""}${b})=0.`),
      S("אפס מאפס", "מכפלה שווה אפס ⇒ אחד הגושים חייב להיות אפס. כל גוש = 0 בנפרד – ומקבלים שני פתרונות.", `x=0 או x${b >= 0 ? "+" : ""}${b}=0.`),
    ];
    steps = [st(`x\\left(${L(x.add(Poly.const(b)))}\\right)=0`, 1, "ועד בית"), st(`x=0,\\ x=${-b}`, 2, "אפס מאפס")];
  } else if (level === 2) {
    // x² - m² = 0
    const m = rint(1, 12);
    lhs = x.pow(2).sub(Poly.const(m * m));
    roots = [-m, m];
    promptLatex = `${L(lhs)}=0`;
    stages = [
      S("תאומים הפוכים / ±", "x² = מספר ⇒ חזקה זוגית מבטלת מינוסים – שני פתרונות: פלוס ומינוס. או: הפרש ריבועים (x+m)(x−m)=0.", `x²=${m * m} ⇒ x=±${m}. או פרקי ל-(x+${m})(x−${m})=0.`),
      S("שני הפתרונות", "אפס מאפס – כל גוש = 0.", `x=${m}, x=${-m}.`),
    ];
    steps = [st(`\\left(x+${m}\\right)\\left(x-${m}\\right)=0`, 1, "תאומים הפוכים"), st(`x=${m},\\ x=${-m}`, 2, "אפס מאפס")];
  } else {
    const p = rnz(-9, 9),
      q = rnz(-9, 9);
    if (p === q) return genQuadraticEq(level);
    lhs = x.add(Poly.const(p)).mul(x.add(Poly.const(q)));
    roots = [-p, -q];
    // sometimes present with terms on both sides
    const shift = Math.random() < 0.4 ? rnz(-9, 9) : 0;
    promptLatex = shift ? `${L(lhs.add(Poly.const(shift)))}=${shift}` : `${L(lhs)}=0`;
    stages = [
      S("הכול לצד אחד, = 0", "אפס מאפס עובד רק כשבצד השני יש 0. ליברמן: הכול לצד אחד.", "העבירי הכול לצד שמאל כך שבצד ימין 0."),
      S("זוג שמסתדר", `מחפשים זוג: מכפלה ${p * q}, סכום ${p + q}.`, `הזוג: ${p} ו-${q}. כתבי (x${p >= 0 ? "+" : ""}${p})(x${q >= 0 ? "+" : ""}${q})=0.`),
      S("אפס מאפס", "מכפלה = 0 ⇒ אחד הגושים אפס. כל גוש = 0 בנפרד.", `x=${-p} או x=${-q}.`),
    ];
    steps = [];
    if (shift) steps.push(st(`${L(lhs)}=0`, 1, "הכול לצד אחד"));
    steps.push(st(`\\left(${L(x.add(Poly.const(p)))}\\right)\\left(${L(x.add(Poly.const(q)))}\\right)=0`, 2, "זוג שמסתדר"), st(`x=${-p},\\ x=${-q}`, 3, "אפס מאפס"));
  }
  return {
    id: uid("quad"),
    typeId: "quadratic_eq",
    topicId: "quadratic_eq",
    kind: "equation",
    level,
    instruction: "פתרי את המשוואה (מצאי את כל הפתרונות):",
    promptLatex,
    finalLatex: roots.map((r) => `x=${r}`).join(",\\ "),
    variable: v,
    solutions: roots,
    stages,
    steps,
    stageOf: (info) => {
      if (!info.lhs || !info.rhs) return 0;
      const pc = parenCount(info.lhs) + parenCount(info.rhs);
      if (pc > 0) return stages.length - 1;
      return 0;
    },
    traps: [],
  };
}

/* =====================================================================
   13. סדר פעולות חשבון (מספרי)
   ===================================================================== */
export function genOrderOps(level: number): Exercise {
  // build a numeric expression with powers, mult, add
  const a = rint(2, 6),
    b = rint(2, 5),
    c = rint(2, 9),
    d = rint(2, 4),
    e = rint(1, 9);
  let latex: string, plain: string, value: number;
  if (level === 1) {
    // a·b² - c·d
    latex = `${a}\\cdot ${b}^{2}-${c}\\cdot ${d}`;
    plain = `${a}*${b}^2-${c}*${d}`;
    value = a * b * b - c * d;
  } else if (level === 2) {
    // (a-b)^2 + c·d^2 : e   with e | c*d^2? use division that works
    const cd = c * d * d;
    const div = pick([1, 2, 3, 4].filter((k) => cd % k === 0));
    latex = `\\left(${a}-${b + 5}\\right)^{2}+${c}\\cdot ${d}^{2}:${div}`;
    plain = `(${a}-${b + 5})^2+${c}*${d}^2/${div}`;
    value = (a - b - 5) ** 2 + cd / div;
  } else {
    // -e·(-d)^2 + a  , or (2 - b^2 : c)^2 style
    latex = `-${e}\\cdot\\left(-${d}\\right)^{2}+${a}^{2}\\cdot ${b}`;
    plain = `-${e}*(-${d})^2+${a}^2*${b}`;
    value = -e * d * d + a * a * b;
  }
  return {
    id: uid("ops"),
    typeId: "order_ops",
    topicId: "order_ops",
    kind: "expr",
    level,
    instruction: "חשבי לפי סדר פעולות חשבון:",
    promptLatex: latex,
    originalPlain: plain,
    finalPlain: `${value}`,
    finalLatex: `${value}`,
    finalForm: "any",
    stages: [
      S("סנובים קודם", "סדר פעולות: סוגריים → חזקות ושורשים (הכי סנוביות) → כפל וחילוק → חיבור וחיסור (הכי נחמדים, אחרונים). מינוס לפני חזקה: (−3)² זה 9, אבל −3² זה −9.", "חשבי קודם מה בסוגריים ואת החזקות, אחר-כך כפל/חילוק, ורק בסוף חיבור/חיסור."),
    ],
    steps: [st(`${value}`, 1, "סנובים קודם")],
    stageOf: () => 0,
    traps: [],
  };
}

/* ---------- registry ---------- */
export const GENERATORS: Record<string, (level: number) => Exercise> = {
  like_terms: genLikeTerms,
  mono_mul: genMonoMul,
  distribute: genDistribute,
  binomial: genBinomial,
  common_factor: genCommonFactor,
  fraction_cf: genFractionCF,
  linear_eq: genLinearEq,
  linear_eq_frac: genLinearEqFrac,
  system: genSystem,
  short_mult: genShortMult,
  trinomial: genTrinomial,
  quadratic_eq: genQuadraticEq,
  order_ops: genOrderOps,
};

export function generate(typeId: string, level: number): Exercise {
  const g = GENERATORS[typeId];
  if (!g) throw new Error("unknown type " + typeId);
  for (let i = 0; i < 20; i++) {
    try {
      const ex = g(Math.min(3, Math.max(1, level)));
      // sanity: original parses
      if (ex.kind === "expr" && !parseExpr(ex.originalPlain!)) continue;
      return ex;
    } catch {
      /* retry */
    }
  }
  return g(1);
}
