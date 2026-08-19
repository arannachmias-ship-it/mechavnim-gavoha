/**
 * מחוללי תרגילים – שלב ב': פונקציה קווית, פרבולה, חיתוך פרבולה/ישר, גאומטריה אנליטית.
 * כולם kind = "geo" – ראי geo.ts.
 */
import { frac, fracLatex, F, gcd, rint, rnz, pick, rnd, type Frac } from "./poly";
import type { Exercise, GeoAsk, GeoTrap, PlotSpec, StageInfo, Step } from "./types";
import { segKey } from "./geo";

let counter = 0;
const uid = (t: string) => `${t}-${(counter++).toString(36)}-${Math.floor(rnd() * 1e6).toString(36)}`;
const S = (name: string, hint1: string, hint2: string): StageInfo => ({ name, hint1, hint2 });
const st = (latex: string, stage: number, note: string): Step => ({ latex, stage, note });

/* ---------- עזרי כתיבה ---------- */
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
/** מספר כלטקס – שברים כ-\frac */
function nl(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const f = toFrac(n);
  return fracLatex(f);
}
function toFrac(n: number): Frac {
  for (let d = 1; d <= 24; d++) if (Number.isInteger(Math.round(n * d * 1e6) / 1e6)) return frac(Math.round(n * d), d);
  return frac(Math.round(n * 1000), 1000);
}
/** נקודה כלטקס: \text{A}\left(1,3\right) */
const ptL = (label: string, x: number, y: number) => `${label ? `\\text{${label}}` : ""}\\left(${nl(x)},${nl(y)}\\right)`;
/** y=mx+b בלטקס */
function lineL(m: number, b: number, lhs = "y"): string {
  const mf = toFrac(m);
  let mx: string;
  if (mf.n === 0) mx = "";
  else if (mf.d === 1 && Math.abs(mf.n) === 1) mx = mf.n < 0 ? "-x" : "x";
  else mx = `${fracLatex(mf)}x`;
  const bf = toFrac(b);
  let bs = "";
  if (bf.n !== 0) bs = mx ? fracLatex(bf, { forceSign: true }) : fracLatex(bf);
  const rhs = `${mx}${bs}` || "0";
  return `${lhs}=${rhs}`;
}
/** ax²+bx+c בלטקס */
function quadL(a: number, b: number, c: number): string {
  let s = a === 1 ? "x^{2}" : a === -1 ? "-x^{2}" : `${nl(a)}x^{2}`;
  if (b !== 0) s += b === 1 ? "+x" : b === -1 ? "-x" : `${b > 0 ? "+" : ""}${nl(b)}x`;
  if (c !== 0) s += `${c > 0 ? "+" : ""}${nl(c)}`;
  return s;
}
const val = (key: string, label: string, value: number): GeoAsk => ({ key, label, kind: "value", value });
const point = (key: string, label: string, x: number, y: number): GeoAsk => ({ key, label, kind: "point", x, y });
const eqAsk = (label: string): GeoAsk => ({ key: "eq", label, kind: "eq" });

const NICE_SLOPES = [frac(1, 2), frac(-1, 2), frac(3, 2), frac(-3, 2), frac(2, 3), frac(-2, 3), frac(3, 4), frac(-3, 4), frac(1, 3), frac(-1, 3), frac(4, 3), frac(-4, 3), frac(5, 2), frac(-5, 2)];

/* =====================================================================
   1. לקרוא את הישר – שיפוע, איפה נכנסים לבניין, איפה נוגעים ברצפה
   ===================================================================== */
export function genLineRead(level: number): Exercise {
  let m: Frac;
  if (level === 1) m = frac(pick([1, -1, 2, -2, 3, -3]));
  else m = pick(NICE_SLOPES);
  // b כך שהחיתוך עם ציר x יהיה שלם: b = -m·x0
  const x0 = rnz(-4, 4) * m.d;
  const b = -F.toNumber(m) * x0; // integer since x0 multiple of d
  const mv = F.toNumber(m);
  const asks: GeoAsk[] = [];
  let prompt: string;
  let instruction: string;
  const stages: StageInfo[] = [];
  const steps: Step[] = [];
  const traps: GeoTrap[] = [
    { key: "m", value: b, message: "זה b – הקומה שבה נכנסים לבניין. השיפוע m הוא המספר שצמוד ל-x: כמה קומות עולים על כל צעד.", mistake: "axis_mix" },
    { key: "point", x: b, y: 0, message: "בלבלת בין הקיר לרצפה. ציר y הוא הקיר של הכניסה – שם x=0, והנקודה היא (0, b). על הרצפה (ציר x) y=0.", mistake: "axis_mix" },
    { key: "point", x: -x0, y: 0, message: "כמעט – הסימן. פותרים 0=mx+b: מעבירים את b צד (מראת הקסמים) ומחלקים ב-m. בדקי בהצבה שמקבלים אפס.", mistake: "sign" },
  ];
  if (level <= 2) {
    prompt = lineL(mv, b);
    instruction = "לפנייך פונקציה קווית. מצאי: את השיפוע m, את נקודת החיתוך עם ציר y, ואת נקודת החיתוך עם ציר x.";
    asks.push(val("m", "השיפוע m – כמה קומות על כל צעד", mv), point("Py", "החיתוך עם ציר y – איפה נכנסים לבניין (x=0)", 0, b), point("Px", "החיתוך עם ציר x – איפה נוגעים ברצפה (y=0)", x0, 0));
    stages.push(
      S("השיפוע – קומות על כל צעד", "בכתיב $y=mx+b$ השיפוע הוא המספר שצמוד ל-x. חיובי – עולים, שלילי – יורדים. שבר? הכפל בכל צעד קדימה, לא בקומות.", `m הוא המקדם של x. כאן m=${num(mv)}. כתבי: m=${num(mv)}`),
      S("איפה נכנסים לבניין", "ציר y הוא **הקיר של הכניסה** – הוא נמצא בדיוק ב-x=0. מה יוצא כשעוד לא עשית אף צעד? מוחקים את mx (כי m·0=0) ונשאר b.", `x=0 ⇒ y=b=${num(b)}. הנקודה: (0, ${num(b)})`),
      S("איפה נוגעים ברצפה", "ציר x הוא **הרצפה** – שם y=0. השאלה ההפוכה: כמה צעדים עד שהגעת לרצפה? מציבים y=0 ופותרים משוואה.", `0=${num(mv)}x${b >= 0 ? "+" : ""}${num(b)} ⇒ x=${num(x0)}. הנקודה: (${num(x0)}, 0)`)
    );
    steps.push(st(`m=${nl(mv)}`, 1, "השיפוע – המספר שצמוד ל-x."), st(ptL("", 0, b), 2, `הקיר של הכניסה: x=0 ⇒ y=${num(b)}.`), st(ptL("", x0, 0), 3, `הרצפה: y=0 ⇒ 0=${num(mv)}x${b >= 0 ? "+" : ""}${num(b)} ⇒ x=${num(x0)}.`));
  } else {
    // הישר "מחופש": צריך לבודד y קודם
    const k = pick([2, 3, -2]);
    // k·y = k·m x + k·b  → צורות: ky - kmx = kb ; ky + (-km)x = kb
    const km = mv * k,
      kb = b * k;
    const forms = [
      `${nl(k)}y=${quadLin(km, kb)}`,
      `${nl(k)}y${km >= 0 ? "-" : "+"}${nl(Math.abs(km))}x=${nl(kb)}`,
      `${quadLin(-km, 0)}+${nl(k)}y=${nl(kb)}`.replace("+-", "-"),
    ];
    prompt = pick(forms);
    instruction = "הישר הזה מחופש. קודם בודדי את y (ליברמן: y לבד בצד אחד), ואז מצאי: את משוואת הישר בצורה y=mx+b, את m, ואת נקודות החיתוך עם שני הצירים.";
    asks.push(eqAsk("המשוואה בצורה y=mx+b"), val("m", "השיפוע m", mv), point("Py", "החיתוך עם ציר y (x=0)", 0, b), point("Px", "החיתוך עם ציר x (y=0)", x0, 0));
    stages.push(
      S("לבודד את y", "זו משוואה עם y ו-x. מר גזען: y לבד בצד אחד, כל השאר בצד השני – ואז מחלקים במקדם של y (שונא שברים? חלקי כל גוש בנפרד).", `חלקי הכול ב-${num(k)} אחרי שהעברת את x צד: ${lineL(mv, b)}`),
      S("השיפוע", "עכשיו כש-y לבד – השיפוע הוא המספר שצמוד ל-x.", `m=${num(mv)}`),
      S("איפה נכנסים לבניין", "ציר y = הקיר של הכניסה, x=0. נשאר b.", `(0, ${num(b)})`),
      S("איפה נוגעים ברצפה", "ציר x = הרצפה, y=0. מציבים ופותרים.", `(${num(x0)}, 0)`)
    );
    steps.push(st(lineL(mv, b), 1, `בודדנו את y: חילקנו הכול ב-${num(k)}.`), st(`m=${nl(mv)}`, 2, "השיפוע – צמוד ל-x."), st(ptL("", 0, b), 3, "x=0 – הקיר של הכניסה."), st(ptL("", x0, 0), 4, "y=0 – הרצפה."));
  }
  const plot: PlotSpec = { lines: [{ m: mv, b }] };
  return {
    id: uid("lr"),
    typeId: "line_read",
    topicId: "linear_func",
    kind: "geo",
    level,
    instruction,
    promptLatex: prompt,
    finalLatex: `m=${nl(mv)},\\ ${ptL("", 0, b)},\\ ${ptL("", x0, 0)}`,
    asks,
    curve: { kind: "line", coeffs: [mv, b] },
    params: { m: mv, b },
    geoTraps: traps,
    plot,
    stages,
    steps,
  };
}
/** "kx + c" כלטקס בלי y */
function quadLin(k: number, c: number): string {
  let s = k === 1 ? "x" : k === -1 ? "-x" : `${nl(k)}x`;
  if (c !== 0) s += `${c > 0 ? "+" : ""}${nl(c)}`;
  return s;
}

/* =====================================================================
   2. ישר דרך שתי נקודות / מקביל / מאונך
   ===================================================================== */
export function genLineThrough(level: number): Exercise {
  let m: Frac;
  let x1: number, y1: number, x2: number, y2: number;
  let b: number;
  const asks: GeoAsk[] = [];
  const traps: GeoTrap[] = [];
  const stages: StageInfo[] = [];
  const steps: Step[] = [];
  let prompt: string, instruction: string;
  const plot: PlotSpec = {};
  if (level <= 2) {
    m = level === 1 ? frac(pick([1, -1, 2, -2, 3, -3, 4])) : pick(NICE_SLOPES);
    x1 = rint(-4, 4);
    const dx = m.d * pick(level === 1 ? [1, 2, 3] : [1, 2]);
    x2 = x1 + dx * pick([1, -1]);
    b = rint(-5, 5);
    y1 = F.toNumber(m) * x1 + b;
    y2 = F.toNumber(m) * x2 + b;
    // keep numbers small
    if (Math.abs(y1) > 12 || Math.abs(y2) > 12) return genLineThrough(level);
    prompt = `${ptL("A", x1, y1)},\\ ${ptL("B", x2, y2)}`;
    instruction = "מצאי את משוואת הישר העובר דרך הנקודות A ו-B (בצורה y=mx+b): קודם השיפוע, אז b, ואז המשוואה.";
    plot.points = [
      { x: x1, y: y1, label: "A" },
      { x: x2, y: y2, label: "B" },
    ];
    const mv = F.toNumber(m);
    traps.push(
      { key: "m", value: (x2 - x1) / (y2 - y1), message: "הפכת את השבר. שיפוע = קומות חלקי צעדים: ההפרש ב-y למעלה, ההפרש ב-x למטה.", mistake: "slope_flip" },
      { key: "b", value: y1, message: "b הוא ה-y כש-x=0 – הקומה שבה נכנסים לבניין. זה לא ה-y של הנקודה A. הציבי את A ב-y=mx+b ובודדי את b.", mistake: "geo" },
      { key: "b", value: y2, message: "b הוא ה-y כש-x=0. הציבי נקודה ב-y=mx+b ובודדי את b.", mistake: "geo" }
    );
    stages.push(
      S("השיפוע – קומות על כל צעד", "שיפוע = כמה קומות עולים על כל צעד קדימה. בין שתי נקודות: ההפרש בקומות (y) חלקי ההפרש בצעדים (x). באותו סדר למעלה ולמטה!", `m=\\frac{${num(y2)}-(${num(y1)})}{${num(x2)}-(${num(x1)})}=${num(mv)}`),
      S("b – איפה נכנסים לבניין", "יש לך m. עכשיו y=mx+b עם b לא ידוע. מציבים נקודה אחת שהישר עובר בה (x ו-y שלה) – ומקבלים משוואה עם b בלבד. מר גזען.", `${num(y1)}=${num(mv)}·(${num(x1)})+b ⇒ b=${num(b)}`),
      S("כותבים את הישר", "עכשיו יש m ויש b. כותבים y=mx+b עם המספרים. בדיקה: הציבי את הנקודה השנייה ותראי שזה מסתדר.", lineL(mv, b).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2"))
    );
    asks.push(val("m", "השיפוע m", mv), val("b", "b – איפה נכנסים לבניין", b), eqAsk("משוואת הישר y=mx+b"));
    steps.push(st(`m=\\frac{${nl(y2)}-\\left(${nl(y1)}\\right)}{${nl(x2)}-\\left(${nl(x1)}\\right)}=${nl(mv)}`, 1, "קומות חלקי צעדים – באותו סדר למעלה ולמטה."), st(`b=${nl(y1)}-${nl(mv)}\\cdot\\left(${nl(x1)}\\right)=${nl(b)}`, 2, "הצבנו את A ב-y=mx+b ובודדנו את b."), st(lineL(mv, b), 3, "m ו-b בפנים – זו המשוואה. הציבי את B לבדיקה."));
    return {
      id: uid("lt"),
      typeId: "line_through",
      topicId: "linear_func",
      kind: "geo",
      level,
      instruction,
      promptLatex: prompt,
      finalLatex: lineL(mv, b),
      asks,
      curve: { kind: "line", coeffs: [mv, b] },
      params: { m: mv, b },
      geoTraps: traps,
      plot,
      stages,
      steps,
    };
  }
  // level 3: through a point, parallel / perpendicular to a given line
  const given = pick([frac(2), frac(-2), frac(3), frac(1, 2), frac(-1, 2), frac(3, 2), frac(-3, 4), frac(2, 3), frac(4)]);
  const perp = rnd() < 0.6;
  m = perp ? F.neg(F.div(frac(1), given)) : given;
  const mv = F.toNumber(m);
  const gb = rint(-4, 4);
  x1 = rnz(-4, 4) * m.d;
  b = rint(-5, 5);
  y1 = mv * x1 + b;
  if (Math.abs(y1) > 12 || (near(b, gb) && !perp)) return genLineThrough(3);
  const gm = F.toNumber(given);
  prompt = `${ptL("A", x1, y1)},\\quad ${lineL(gm, gb)}`;
  instruction = perp ? "מצאי את משוואת הישר העובר דרך A ומאונך לישר הנתון. קודם השיפוע (הפוך והפוך), אז b, ואז המשוואה." : "מצאי את משוואת הישר העובר דרך A ומקביל לישר הנתון. קודם השיפוע (אותו קצב), אז b, ואז המשוואה.";
  plot.points = [{ x: x1, y: y1, label: "A" }];
  plot.lines = [{ m: gm, b: gb }];
  if (perp) {
    traps.push(
      { key: "m", value: gm, message: "זה השיפוע של הישר הנתון – זה מקביל, לא מאונך. מאונך = הופכים פעמיים: את השבר ואת הסימן.", mistake: "perp" },
      { key: "m", value: -gm, message: "הפכת רק את הסימן. מאונך = הפוך והפוך – גם את השבר וגם את הסימן. בדיקה: m₁·m₂ צריך לצאת −1.", mistake: "perp" },
      { key: "m", value: 1 / gm, message: "הפכת רק את השבר. מאונך = הפוך והפוך – גם השבר וגם הסימן. בדיקה: m₁·m₂ = −1.", mistake: "perp" }
    );
  } else {
    traps.push({ key: "m", value: -1 / gm, message: "זה שיפוע מאונך (הפוך והפוך). מקביל = אותו קצב בדיוק, אותו שיפוע – אף פעם לא נפגשים.", mistake: "perp" });
  }
  traps.push({ key: "b", value: y1, message: "b הוא ה-y כש-x=0, לא ה-y של A. הציבי את A ב-y=mx+b ובודדי את b.", mistake: "geo" }, { key: "b", value: gb, message: "זה ה-b של הישר הנתון. הישר שלנו עובר דרך A – הציבי את A ומצאי את ה-b שלו.", mistake: "geo" });
  stages.push(
    perp
      ? S("מאונך – הפוך והפוך", "מאונך = מהפכים פעמיים: את השבר ואת הסימן. אחד עולה 2 קומות על כל צעד? המאונך לו יורד חצי קומה. ואם תכפילי את השניים תמיד תקבלי −1 – זו הבדיקה.", `השיפוע הנתון ${num(gm)} ⇒ המאונך: m=${num(mv)} (בדיקה: ${num(gm)}·(${num(mv)})=−1)`)
      : S("מקביל – אותו קצב", "מקבילים – אותו קצב בדיוק. עולים באותו שיפוע, אף פעם לא נפגשים. אז m שלנו = m של הישר הנתון.", `m=${num(mv)}`),
    S("b – מציבים את A", "y=mx+b עם ה-m שמצאת. מציבים את A (x ו-y שלה) ומבודדים את b. מר גזען.", `${num(y1)}=${num(mv)}·(${num(x1)})+b ⇒ b=${num(b)}`),
    S("כותבים את הישר", "m ו-b – וכותבים y=mx+b.", lineL(mv, b).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2"))
  );
  asks.push(val("m", perp ? "השיפוע m – הפוך והפוך" : "השיפוע m – אותו קצב", mv), val("b", "b – מציבים את A", b), eqAsk("משוואת הישר y=mx+b"));
  steps.push(st(`m=${nl(mv)}`, 1, perp ? "הפוך והפוך: הפכנו את השבר ואת הסימן." : "מקביל – אותו שיפוע."), st(`b=${nl(y1)}-${nl(mv)}\\cdot\\left(${nl(x1)}\\right)=${nl(b)}`, 2, "הצבנו את A ובודדנו את b."), st(lineL(mv, b), 3, "המשוואה."));
  return {
    id: uid("lt"),
    typeId: "line_through",
    topicId: "linear_func",
    kind: "geo",
    level,
    instruction,
    promptLatex: prompt,
    finalLatex: lineL(mv, b),
    asks,
    curve: { kind: "line", coeffs: [mv, b] },
    params: { m: mv, b },
    geoTraps: traps,
    plot,
    stages,
    steps,
  };
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/* =====================================================================
   3. פרבולה – חיוך/עצוב, הקיר, הרצפה, הפסגה
   ===================================================================== */
export function genParabolaFeatures(level: number): Exercise {
  const a = level === 3 ? pick([-1, 2, -1, 1]) : 1;
  let r1 = rint(-5, 5),
    r2 = rint(-5, 5);
  // לא r1 = -r2: אז הקודקוד יושב על ציר y ושתי הבקשות מתמזגות
  while (r2 === r1 || r2 === -r1 || (level === 1 && (r1 + r2) % 2 !== 0)) {
    r1 = rint(-5, 5);
    r2 = rint(-5, 5);
  }
  if (r1 > r2) [r1, r2] = [r2, r1];
  const b = -a * (r1 + r2),
    c = a * r1 * r2;
  const xv = (r1 + r2) / 2,
    yv = a * xv * xv + b * xv + c;
  if (Math.abs(yv) > 20 || Math.abs(c) > 20) return genParabolaFeatures(level);
  const prompt = `y=${quadL(a, b, c)}`;
  const smile = a > 0;
  const asks: GeoAsk[] = [];
  const stages: StageInfo[] = [];
  const steps: Step[] = [];
  const traps: GeoTrap[] = [
    { key: "point", x: c, y: 0, message: "בלבלת בין הקיר לרצפה: על ציר y ה-x הוא 0, אז הנקודה היא (0, c). על הרצפה (ציר x) y=0 – ושם צריך לפתור משוואה.", mistake: "axis_mix" },
    { key: "x", value: -xv, message: "ציר הסימטריה הוא x = −b/2a – עם המינוס. בדקי את הסימן של b.", mistake: "vertex_sign" },
    { key: "point", x: -xv, y: a * xv * xv - b * xv + c, message: "הקודקוד נמצא על ציר הסימטריה x=−b/2a – שימי לב למינוס. הוא תמיד בדיוק באמצע בין השורשים.", mistake: "vertex_sign" },
    { key: "point", x: xv, y: 0, message: "האמצע נכון (x של הקודקוד) – אבל y של הקודקוד הוא לא 0. הציבי את x חזרה בפרבולה כדי לקבל את הגובה של הפסגה/העמק.", mistake: "geo" },
  ];
  const yHint = `x=0 ⇒ y=${num(c)}. הנקודה (0, ${num(c)})`;
  const rootsHint = `${quadL(a, b, c).replace(/\^\{2\}/g, "²")}=0 ⇒ ${a !== 1 ? `${num(a)}·` : ""}(x${-r1 >= 0 ? "+" : ""}${num(-r1)})(x${-r2 >= 0 ? "+" : ""}${num(-r2)})=0 ⇒ x=${num(r1)} או x=${num(r2)}. הנקודות (${num(r1)},0), (${num(r2)},0)`;
  const vHint = `x=−b/2a=${num(-b)}/${num(2 * a)}=${num(xv)}. מציבים: y=${num(yv)}. הקודקוד (${num(xv)}, ${num(yv)})`;
  const stY = S("הקיר של הכניסה", "ציר y הוא הקיר של הכניסה – שם x=0. מציבים x=0: כל מה שיש בו x נעלם, ונשאר האיבר החופשי c.", yHint);
  const stRoots = S("איפה נוגעים ברצפה", "ציר x הוא הרצפה – שם y=0. מציבים y=0 ומקבלים משוואה ריבועית: מי גרם לאפס? ועד בית / הזוג שמסתדר / נוסחה.", rootsHint);
  const stV = S("הפסגה (או השיא של העמק)", `הקודקוד יושב על **המראה** של הפרבולה – ציר הסימטריה, x=−b/2a. תמיד בדיוק באמצע בין השורשים. מצאת את x? מציבים בפרבולה ומקבלים את y. ${smile ? "a חיובי – חיוך, אז זה עמק (מינימום)." : "a שלילי – עצוב, אז זו פסגה (מקסימום)."}`, vHint);
  let instruction: string;
  if (level === 1) {
    instruction = `לפנייך פרבולה${smile ? " (a חיובי – חיוך)" : " (a שלילי – עצובה)"}. מצאי: את נקודת החיתוך עם ציר y, ואת הקודקוד.`;
    asks.push(point("Py", "החיתוך עם ציר y – הקיר של הכניסה (x=0)", 0, c), point("V", "הקודקוד – הפסגה או השיא של העמק", xv, yv));
    stages.push(stY, stV);
    steps.push(st(ptL("", 0, c), 1, "x=0 – נשאר c."), st(`x=\\frac{-\\left(${nl(b)}\\right)}{2\\cdot${nl(a)}}=${nl(xv)}`, 2, "ציר הסימטריה – המראה: x=−b/2a."), st(ptL("", xv, yv), 2, `הצבנו x=${num(xv)} וקיבלנו y=${num(yv)}.`));
  } else {
    instruction = `לפנייך פרבולה${smile ? " (a חיובי – חיוך)" : " (a שלילי – עצובה)"}. מצאי: את החיתוך עם ציר y, את נקודות החיתוך עם ציר x, ואת הקודקוד.`;
    asks.push(point("Py", "החיתוך עם ציר y – הקיר (x=0)", 0, c), point("P1", `חיתוך עם ציר x – הרצפה (y=0), נקודה ראשונה`, r1, 0), point("P2", `חיתוך עם ציר x – הרצפה, נקודה שנייה`, r2, 0), point("V", "הקודקוד – באמצע בין השורשים", xv, yv));
    stages.push(stY, stRoots, stRoots, stV);
    steps.push(
      st(ptL("", 0, c), 1, "הקיר של הכניסה: x=0."),
      st(`${quadL(a, b, c)}=0`, 2, "הרצפה: y=0 – משוואה ריבועית."),
      st(`${a !== 1 ? `${nl(a)}` : ""}\\left(x${-r1 >= 0 ? "+" : ""}${nl(-r1)}\\right)\\left(x${-r2 >= 0 ? "+" : ""}${nl(-r2)}\\right)=0`, 2, "מפרקים – מי גרם לאפס?"),
      st(`${ptL("", r1, 0)},${ptL("", r2, 0)}`, 3, "כל גוש בנפרד שווה אפס – שני השורשים, על הרצפה."),
      st(`x=\\frac{-\\left(${nl(b)}\\right)}{2\\cdot${nl(a)}}=${nl(xv)}`, 4, "המראה: x=−b/2a – בדיוק באמצע בין השורשים."),
      st(ptL("", xv, yv), 4, `הצבנו x=${num(xv)}: y=${num(yv)}.`)
    );
  }
  return {
    id: uid("pf"),
    typeId: "parabola_features",
    topicId: "parabola",
    kind: "geo",
    level,
    instruction,
    promptLatex: prompt,
    finalLatex: `${ptL("", 0, c)},\\ ${level >= 2 ? `${ptL("", r1, 0)},\\ ${ptL("", r2, 0)},\\ ` : ""}\\text{V}${ptL("", xv, yv)}`,
    asks,
    curve: { kind: "parabola", coeffs: [a, b, c] },
    params: { a, b, c },
    geoTraps: traps,
    plot: { parabolas: [{ a, b, c }] },
    stages,
    steps,
  };
}

/* =====================================================================
   4. פרבולה פוגשת ישר – משווים, ואז מי גרם לאפס
   ===================================================================== */
export function genParabolaLine(level: number): Exercise {
  const a = level === 3 ? pick([1, -1, 2]) : 1;
  const tangent = level === 3 && rnd() < 0.3;
  let r1 = rint(-4, 4),
    r2 = tangent ? r1 : rint(-4, 4);
  while (!tangent && r2 === r1) r2 = rint(-4, 4);
  if (r1 > r2) [r1, r2] = [r2, r1];
  // line
  let m = 0,
    n = 0;
  if (level === 1) {
    m = 0;
    n = rint(-6, 6);
  } else {
    m = rnz(-3, 3);
    n = rint(-5, 5);
  }
  // parabola: a(x-r1)(x-r2) + (mx+n)
  const b = -a * (r1 + r2) + m,
    c = a * r1 * r2 + n;
  const y1 = m * r1 + n,
    y2 = m * r2 + n;
  if (Math.abs(c) > 20 || Math.abs(y1) > 20 || Math.abs(y2) > 20) return genParabolaLine(level);
  const prompt = `y=${quadL(a, b, c)}\\quad ,\\quad ${lineL(m, n)}`;
  const asks: GeoAsk[] = tangent ? [point("P1", "נקודת החיתוך (יש רק אחת – הישר משיק)", r1, y1)] : [point("P1", "נקודת חיתוך ראשונה", r1, y1), point("P2", "נקודת חיתוך שנייה", r2, y2)];
  const dl = quadL(a, b - m, c - n);
  const stages: StageInfo[] = [
    S("שתי מכונות, אותו x ואותו y", "בנקודת חיתוך שתי הפונקציות נותנות אותו y לאותו x. אז משווים: מה שהפרבולה נותנת = מה שהישר נותן. מקבלים משוואה עם x בלבד.", `${quadL(a, b, c).replace(/\^\{2\}/g, "²")} = ${lineL(m, n).slice(2)}`),
    S("הכול לצד אחד – מי גרם לאפס?", "מעבירים הכול לצד אחד (מראת הקסמים), אפס בצד השני. עכשיו זו משוואה ריבועית: גורם משותף? הזוג שמסתדר? נוסחה.", `${dl.replace(/\^\{2\}/g, "²")}=0 ⇒ x=${num(r1)}${tangent ? "" : ` או x=${num(r2)}`}`),
    S("ה-y של כל נקודה", "יש x-ים. לכל אחד מציבים ב**ישר** (יותר קל) ומקבלים את ה-y. כותבים נקודות (x, y).", `x=${num(r1)} ⇒ y=${num(y1)}${tangent ? "" : `; x=${num(r2)} ⇒ y=${num(y2)}`}`),
  ];
  const steps: Step[] = [
    st(`${quadL(a, b, c)}=${lineL(m, n).slice(2)}`, 1, "משווים – אותו x, אותו y."),
    st(`${dl}=0`, 1, "הכול לצד אחד. עכשיו: מי גרם לאפס?"),
    st(tangent ? `x=${nl(r1)}` : `x=${nl(r1)},x=${nl(r2)}`, 1, "השורשים – אלה ה-x-ים של נקודות החיתוך."),
    st(tangent ? ptL("", r1, y1) : `${ptL("", r1, y1)},${ptL("", r2, y2)}`, tangent ? 1 : 2, "הצבנו כל x בישר וקיבלנו את ה-y."),
  ];
  const traps: GeoTrap[] = [{ key: "point", x: r1, y: 0, message: "מצאת את x נכון – אבל y של הנקודה הוא לא 0 (זו לא הרצפה). הציבי את x בישר כדי לקבל את y.", mistake: "geo" }];
  if (!tangent) traps.push({ key: "point", x: r2, y: 0, message: "x נכון, אבל y הוא לא 0. הציבי את x בישר.", mistake: "geo" });
  return {
    id: uid("pl"),
    typeId: "parabola_line",
    topicId: "parabola_line",
    kind: "geo",
    level,
    instruction: tangent ? "מצאי את נקודות החיתוך של הפרבולה והישר. (רמז קטן: אולי יש רק אחת.)" : "מצאי את נקודות החיתוך של הפרבולה והישר.",
    promptLatex: prompt,
    finalLatex: tangent ? ptL("", r1, y1) : `${ptL("", r1, y1)},\\ ${ptL("", r2, y2)}`,
    asks,
    params: { a, b, c, m, n },
    geoTraps: traps,
    plot: { parabolas: [{ a, b, c }], lines: [{ m, b: n }] },
    stages,
    steps,
  };
}

/* =====================================================================
   5. מרחק ואמצע – פיתגורס בתחפושת
   ===================================================================== */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
  [8, 15, 17],
  [9, 12, 15],
  [12, 9, 15],
];
export function genDistanceMid(level: number): Exercise {
  const [dx0, dy0, d] = level === 1 ? pick(TRIPLES.slice(0, 4)) : pick(TRIPLES);
  const sx = pick([1, -1]),
    sy = pick([1, -1]);
  let x1 = rint(level === 1 ? 0 : -6, level === 1 ? 4 : 5),
    y1 = rint(level === 1 ? 0 : -6, level === 1 ? 4 : 5);
  if (level === 1) {
    // אמצע שלם: סכומים זוגיים
    if ((2 * x1 + sx * dx0) % 2 !== 0) x1++;
    if ((2 * y1 + sy * dy0) % 2 !== 0) y1++;
  }
  const x2 = x1 + sx * dx0,
    y2 = y1 + sy * dy0;
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const asks: GeoAsk[] = [];
  const traps: GeoTrap[] = [
    { key: "d", value: d * d, message: "זה d בריבוע. פיתגורס נותן את הריבוע של היתר – ובסוף לוקחים שורש. d=√" + d * d + "=" + d, mistake: "sqrt" },
    { key: "d", value: dx0 + dy0, message: "חיברת את הניצבים. המרחק הוא היתר – ובמשולש ישר זווית היתר לא שווה לסכום הניצבים. פיתגורס: ריבוע ועוד ריבוע, ואז שורש.", mistake: "sqrt" },
    { key: "point", x: (x2 - x1) / 2, y: (y2 - y1) / 2, message: "חיסרת. אמצע = ממוצע: מחברים את שני האיקסים ומחלקים ב-2, וכך גם עם הוואיים.", mistake: "mid_sub" },
    { key: "point", x: x1 + x2, y: y1 + y2, message: "חיברת אבל שכחת לחלק ב-2. אמצע = ממוצע.", mistake: "mid_sub" },
  ];
  const stages: StageInfo[] = [];
  const steps: Step[] = [];
  let prompt: string, instruction: string;
  const plot: PlotSpec = {};
  const dStage = S("המרחק – זה פיתגורס", "לא נוסחה חדשה. בין שתי נקודות יש משולש ישר זווית: ניצב אחד הוא ההפרש ב-x, השני ההפרש ב-y, והמרחק הוא היתר. תסתכלי בציור – ואז ריבוע ועוד ריבוע, שורש.", `d=√((${num(x2)}−${num(x1)})²+(${num(y2)}−${num(y1)})²)=√(${dx0}²+${dy0}²)=√${d * d}=${d}`);
  const mStage = S("האמצע – ממוצע", "אמצע קטע: ממוצע של האיקסים, ממוצע של הוואיים. מחברים ומחלקים ב-2 – כמו ממוצע של שני ציונים. תביני למה, לא תשנני.", `M=((${num(x1)}+${num(x2)})/2, (${num(y1)}+${num(y2)})/2)=(${num(mx)}, ${num(my)})`);
  if (level <= 2) {
    prompt = `${ptL("A", x1, y1)},\\ ${ptL("B", x2, y2)}`;
    instruction = "לפנייך שתי נקודות. מצאי: את המרחק d ביניהן, ואת נקודת האמצע M של הקטע AB.";
    asks.push(val("d", "המרחק AB – פיתגורס", d), point("M", "האמצע M – ממוצע האיקסים, ממוצע הוואיים", mx, my));
    stages.push(dStage, mStage);
    steps.push(st(`d=\\sqrt{\\left(${nl(x2)}-\\left(${nl(x1)}\\right)\\right)^{2}+\\left(${nl(y2)}-\\left(${nl(y1)}\\right)\\right)^{2}}=${d}`, 1, `הניצבים ${dx0} ו-${dy0}, היתר ${d}.`), st(`M=\\left(\\frac{${nl(x1)}+${nl(x2)}}{2},\\frac{${nl(y1)}+${nl(y2)}}{2}\\right)`, 2, "ממוצע האיקסים, ממוצע הוואיים."));
    plot.points = [
      { x: x1, y: y1, label: "A" },
      { x: x2, y: y2, label: "B" },
    ];
    plot.segments = [
      { a: [x1, y1], b: [x2, y2] },
      { a: [x1, y1], b: [x2, y1], dashed: true },
      { a: [x2, y1], b: [x2, y2], dashed: true },
    ];
  } else {
    // נתונים A ו-M – מצאי את B ואת המרחק
    prompt = `${ptL("A", x1, y1)},\\ ${ptL("M", mx, my)}`;
    instruction = "M היא אמצע הקטע AB. מצאי את הנקודה B, ואז את המרחק AB.";
    asks.push(point("B", "הנקודה B – מהאמצע חזרה", x2, y2), val("d", "המרחק AB", d));
    stages.push(S("מהאמצע חזרה", "האמצע הוא ממוצע. אז (x_A + x_B)/2 = x_M – משוואה עם x_B בלבד. מר גזען: כפול 2, מעבירים צד. אותו דבר עם y.", `x_B=2·${num(mx)}−${num(x1)}=${num(x2)}, y_B=2·${num(my)}−${num(y1)}=${num(y2)}`), dStage);
    steps.push(st(`${ptL("B", x2, y2)}`, 1, `x_B=2·${num(mx)}−(${num(x1)})=${num(x2)}, y_B=2·${num(my)}−(${num(y1)})=${num(y2)}.`), st(`d=\\sqrt{\\left(${nl(x2)}-\\left(${nl(x1)}\\right)\\right)^{2}+\\left(${nl(y2)}-\\left(${nl(y1)}\\right)\\right)^{2}}=${d}`, 2, "פיתגורס."));
    plot.points = [
      { x: x1, y: y1, label: "A" },
      { x: mx, y: my, label: "M" },
    ];
    traps.length = 0;
    traps.push({ key: "point", x: mx * 2, y: my * 2, message: "הכפלת ב-2 אבל שכחת להחסיר את A. x_B = 2·x_M − x_A.", mistake: "mid_sub" }, { key: "d", value: d / 2, message: "זה המרחק מ-A ל-M – חצי הקטע. AB הוא כפול, או: פיתגורס בין A ל-B.", mistake: "geo" });
  }
  return {
    id: uid("dm"),
    typeId: "distance_mid",
    topicId: "analytic",
    kind: "geo",
    level,
    instruction,
    promptLatex: prompt,
    finalLatex: level <= 2 ? `d=${d},\\ ${ptL("M", mx, my)}` : `${ptL("B", x2, y2)},\\ d=${d}`,
    asks,
    params: { d, [segKey("AB")]: d, [segKey("AM")]: d / 2, [segKey("MB")]: d / 2 },
    aliases: { [segKey("AB")]: "d" },
    geoTraps: traps,
    plot,
    stages,
    steps,
  };
}

/* =====================================================================
   6. מקבילים ומאונכים – הפוך והפוך
   ===================================================================== */
export function genSlopesPerp(level: number): Exercise {
  if (level === 1) {
    const g = pick([frac(2), frac(-2), frac(3), frac(-3), frac(1, 2), frac(-1, 2), frac(3, 4), frac(-2, 3), frac(4), frac(5, 2), frac(1, 4)]);
    const gm = F.toNumber(g);
    const gb = rint(-5, 5);
    const perpM = -1 / gm;
    const prompt = lineL(gm, gb);
    const asks = [val("m", "שיפוע הישר המאונך – הפוך והפוך", perpM)];
    const traps: GeoTrap[] = [
      { key: "m", value: gm, message: "זה השיפוע של הישר עצמו (מקביל). מאונך = הופכים פעמיים – את השבר ואת הסימן.", mistake: "perp" },
      { key: "m", value: -gm, message: "הפכת רק את הסימן. גם את השבר! 2 ⇒ −½. בדיקה: המכפלה צריכה לצאת −1.", mistake: "perp" },
      { key: "m", value: 1 / gm, message: "הפכת רק את השבר. גם את הסימן! בדיקה: m₁·m₂ = −1.", mistake: "perp" },
    ];
    return {
      id: uid("sp"),
      typeId: "slopes_perp",
      topicId: "analytic",
      kind: "geo",
      level,
      instruction: "מצאי את השיפוע של ישר המאונך לישר הנתון. (רק את השיפוע: m=…)",
      promptLatex: prompt,
      finalLatex: `m=${nl(perpM)}`,
      asks,
      params: { m: perpM },
      geoTraps: traps,
      plot: { lines: [{ m: gm, b: gb }] },
      stages: [S("הפוך והפוך", "מאונך = מהפכים פעמיים: את השבר ואת הסימן. אחד עולה 2 קומות על כל צעד? המאונך לו יורד חצי קומה על כל צעד. ואם תכפילי את השניים תמיד תקבלי −1 – זו הבדיקה.", `השיפוע הנתון ${num(gm)}. הופכים את השבר: ${num(1 / gm)}. הופכים את הסימן: ${num(perpM)}. בדיקה: ${num(gm)}·(${num(perpM)})=−1 ✔`)],
      steps: [st(`m=${nl(perpM)}`, 1, "הפכנו את השבר ואת הסימן. בדיקה: המכפלה −1.")],
    };
  }
  // level 2/3: through two points
  const m = level === 2 ? pick([frac(1), frac(-1), frac(2), frac(-2), frac(1, 2), frac(-1, 2), frac(3), frac(-3), frac(2, 3)]) : pick(NICE_SLOPES.concat([frac(2), frac(-2), frac(3)]));
  const mv = F.toNumber(m);
  const x1 = rint(-4, 3);
  const dx = m.d * pick([1, 2]);
  const x2 = x1 + dx;
  const y1 = rint(-4, 4);
  const y2 = y1 + mv * dx;
  if (Math.abs(y2) > 10) return genSlopesPerp(level);
  const perpM = -1 / mv;
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const traps: GeoTrap[] = [
    { key: "m1", value: dx / (y2 - y1), message: "הפכת את השבר של שיפוע AB. קומות (y) למעלה, צעדים (x) למטה.", mistake: "slope_flip" },
    { key: "m2", value: mv, message: "זה שיפוע AB עצמו. המאונך = הפוך והפוך.", mistake: "perp" },
    { key: "m2", value: -mv, message: "הפכת רק את הסימן. גם את השבר – הפוך והפוך. בדיקה: המכפלה −1.", mistake: "perp" },
    { key: "m2", value: 1 / mv, message: "הפכת רק את השבר. גם את הסימן. בדיקה: m₁·m₂ = −1.", mistake: "perp" },
  ];
  const prompt = `${ptL("A", x1, y1)},\\ ${ptL("B", x2, y2)}`;
  const s1 = S("שיפוע AB", "קודם השיפוע של AB: קומות חלקי צעדים – ההפרש ב-y חלקי ההפרש ב-x. כתבי m_1=…", `m₁=(${num(y2)}−${num(y1)})/(${num(x2)}−${num(x1)})=${num(mv)}`);
  const s2 = S("המאונך – הפוך והפוך", "מאונך = הופכים פעמיים: את השבר ואת הסימן. בדיקה: m₁·m₂ = −1. כתבי m_2=…", `m₂=${num(perpM)} (בדיקה: ${num(mv)}·(${num(perpM)})=−1)`);
  if (level === 2) {
    return {
      id: uid("sp"),
      typeId: "slopes_perp",
      topicId: "analytic",
      kind: "geo",
      level,
      instruction: "מצאי את שיפוע הישר AB (כתבי m_1=…), ואז את שיפוע הישר המאונך ל-AB (כתבי m_2=…).",
      promptLatex: prompt,
      finalLatex: `m_1=${nl(mv)},\\ m_2=${nl(perpM)}`,
      asks: [val("m1", "שיפוע AB (m₁)", mv), val("m2", "שיפוע המאונך (m₂) – הפוך והפוך", perpM)],
      params: { m1: mv, m2: perpM },
      geoTraps: traps,
      plot: { points: [{ x: x1, y: y1, label: "A" }, { x: x2, y: y2, label: "B" }], segments: [{ a: [x1, y1], b: [x2, y2] }] },
      stages: [s1, s2],
      steps: [st(`m_1=\\frac{${nl(y2)}-\\left(${nl(y1)}\\right)}{${nl(x2)}-\\left(${nl(x1)}\\right)}=${nl(mv)}`, 1, "קומות חלקי צעדים."), st(`m_2=${nl(perpM)}`, 2, "הפוך והפוך. בדיקה: המכפלה −1.")],
    };
  }
  // level 3: אנך אמצעי – עובר דרך האמצע, מאונך ל-AB
  const bb = my - perpM * mx;
  return {
    id: uid("sp"),
    typeId: "slopes_perp",
    topicId: "analytic",
    kind: "geo",
    level,
    instruction: "מצאי את משוואת האנך האמצעי לקטע AB: הישר שעובר דרך אמצע הקטע ומאונך לו. (m_1 שיפוע AB, M האמצע, m_2 שיפוע המאונך, ואז המשוואה y=…)",
    promptLatex: prompt,
    finalLatex: lineL(perpM, bb),
    asks: [val("m1", "שיפוע AB (m₁)", mv), point("M", "אמצע הקטע M – ממוצע האיקסים והוואיים", mx, my), val("m2", "שיפוע המאונך (m₂) – הפוך והפוך", perpM), eqAsk("משוואת האנך האמצעי y=mx+b")],
    curve: { kind: "line", coeffs: [perpM, bb] },
    params: { m1: mv, m2: perpM, m: perpM, b: bb },
    geoTraps: traps.concat([{ key: "point", x: (x2 - x1) / 2, y: (y2 - y1) / 2, message: "חיסרת. אמצע = ממוצע – מחברים ומחלקים ב-2.", mistake: "mid_sub" }]),
    plot: { points: [{ x: x1, y: y1, label: "A" }, { x: x2, y: y2, label: "B" }], segments: [{ a: [x1, y1], b: [x2, y2] }] },
    stages: [s1, S("האמצע", "האנך האמצעי עובר דרך אמצע הקטע: ממוצע האיקסים, ממוצע הוואיים.", `M=(${num(mx)}, ${num(my)})`), s2, S("הישר עצמו", "יש שיפוע (m₂) ויש נקודה (M). y=m₂x+b: מציבים את M ומבודדים את b. ואז כותבים את המשוואה.", `${num(my)}=${num(perpM)}·${num(mx)}+b ⇒ b=${num(bb)} ⇒ ${lineL(perpM, bb).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2")}`)],
    steps: [
      st(`m_1=\\frac{${nl(y2)}-\\left(${nl(y1)}\\right)}{${nl(x2)}-\\left(${nl(x1)}\\right)}=${nl(mv)}`, 1, "שיפוע AB – קומות חלקי צעדים."),
      st(`M=\\left(\\frac{${nl(x1)}+${nl(x2)}}{2},\\frac{${nl(y1)}+${nl(y2)}}{2}\\right)`, 2, "האמצע – ממוצע."),
      st(`m_2=${nl(perpM)}`, 3, "הפוך והפוך."),
      st(`b=${nl(my)}-${nl(perpM)}\\cdot\\left(${nl(mx)}\\right)=${nl(bb)}`, 4, "הצבנו את M ובודדנו את b."),
      st(lineL(perpM, bb), 4, "האנך האמצעי."),
    ],
  };
}

/* =====================================================================
   7. שטח – מי הגובה?
   ===================================================================== */
export function genTriangleArea(level: number): Exercise {
  const x0 = rint(-5, 2),
    y0 = rint(-5, 2);
  const w = rint(2, 7),
    h = rint(2, 7);
  if (level === 1) {
    // ישר זווית, ניצבים מקבילים לצירים
    const A: [number, number] = [x0, y0],
      B: [number, number] = [x0 + w, y0],
      C: [number, number] = [x0, y0 + h];
    const S0 = (w * h) / 2;
    return {
      id: uid("ta"),
      typeId: "triangle_area",
      topicId: "analytic",
      kind: "geo",
      level,
      instruction: "מצאי את שטח המשולש ABC. (רמז: מי הבסיס, מי הגובה? תסתכלי בציור.) כתבי S=…",
      promptLatex: `${ptL("A", ...A)},\\ ${ptL("B", ...B)},\\ ${ptL("C", ...C)}`,
      finalLatex: `S=${nl(S0)}`,
      asks: [val("S", "השטח S – בסיס כפול גובה חלקי 2", S0)],
      params: { S: S0, a: w, h, b: h, [segKey("AB")]: w, [segKey("AC")]: h },
      geoTraps: [
        { key: "S", value: w * h, message: "שכחת לחלק ב-2. משולש הוא חצי מלבן: בסיס·גובה חלקי 2.", mistake: "area_half" },
        { key: "S", value: w + h, message: "חיברת במקום להכפיל. שטח = בסיס·גובה חלקי 2.", mistake: "geo" },
      ],
      plot: { points: [{ x: A[0], y: A[1], label: "A" }, { x: B[0], y: B[1], label: "B" }, { x: C[0], y: C[1], label: "C" }], polygon: [A, B, C] },
      stages: [S("מי הבסיס, מי הגובה?", "שטח משולש = בסיס·גובה חלקי 2 – ותמיד השאלה היא **מי הגובה**. כשצלע מקבילה לציר, אורכה הוא פשוט ההפרש בקואורדינטה שמשתנה. פה AB שוכבת (אותו y) ו-AC עומדת (אותו x) – והן מאונכות זו לזו.", `AB=${w}, AC=${h}. S=${w}·${h}/2=${num(S0)}`)],
      steps: [st(`S=\\frac{${w}\\cdot${h}}{2}=${nl(S0)}`, 1, `הבסיס AB=${w} (הפרש ב-x), הגובה AC=${h} (הפרש ב-y).`)],
    };
  }
  if (level === 2) {
    // בסיס אופקי, קודקוד שלישי איפשהו למעלה
    const A: [number, number] = [x0, y0],
      B: [number, number] = [x0 + w, y0];
    const cx = x0 + rint(-2, w + 2);
    const C: [number, number] = [cx, y0 + h];
    const S0 = (w * h) / 2;
    const slant = Math.round(Math.hypot(cx - x0, h) * 100) / 100;
    return {
      id: uid("ta"),
      typeId: "triangle_area",
      topicId: "analytic",
      kind: "geo",
      level,
      instruction: "מצאי את שטח המשולש ABC. AB מקבילה לציר x – אז הגובה אליה הוא… תסתכלי בציור. כתבי S=…",
      promptLatex: `${ptL("A", ...A)},\\ ${ptL("B", ...B)},\\ ${ptL("C", ...C)}`,
      finalLatex: `S=${nl(S0)}`,
      asks: [val("S", "השטח S", S0)],
      params: { S: S0, a: w, h, b: w, [segKey("AB")]: w },
      geoTraps: [
        { key: "S", value: w * h, message: "שכחת לחלק ב-2. משולש = חצי מלבן.", mistake: "area_half" },
        { key: "S", value: (w * slant) / 2, message: "לקחת צלע משופעת בתור גובה. הגובה תמיד מאונך לבסיס – פה הוא ההפרש בגובה (y) בין C לבין הישר של AB.", mistake: "geo" },
        { key: "h", value: slant, message: "זה אורך של צלע משופעת, לא הגובה. הגובה מאונך לבסיס – ההפרש ב-y.", mistake: "geo" },
      ],
      plot: { points: [{ x: A[0], y: A[1], label: "A" }, { x: B[0], y: B[1], label: "B" }, { x: C[0], y: C[1], label: "C" }], polygon: [A, B, C], segments: [{ a: [cx, y0], b: C, dashed: true }] },
      stages: [S("מי הגובה?", "הבסיס AB שוכב על ישר אופקי – אורכו ההפרש ב-x. הגובה חייב להיות **מאונך** לבסיס: זה המרחק האנכי מ-C עד הישר של AB – ההפרש ב-y. לא הצלע המשופעת!", `AB=${w}, h=${h}. S=${w}·${h}/2=${num(S0)}`)],
      steps: [st(`h=${h}`, 1, `הגובה: ההפרש ב-y בין C (${C[1]}) לבין AB (${y0}).`), st(`S=\\frac{${w}\\cdot${h}}{2}=${nl(S0)}`, 1, `בסיס ${w}, גובה ${h}.`)],
    };
  }
  // level 3: טרפז עם שני בסיסים אופקיים
  const w2 = rint(1, w - 1 || 1);
  const off = rint(0, w - w2);
  const A: [number, number] = [x0, y0],
    B: [number, number] = [x0 + w, y0],
    C: [number, number] = [x0 + off + w2, y0 + h],
    D: [number, number] = [x0 + off, y0 + h];
  const S0 = ((w + w2) * h) / 2;
  return {
    id: uid("ta"),
    typeId: "triangle_area",
    topicId: "analytic",
    kind: "geo",
    level,
    instruction: "ABCD טרפז (AB ו-DC מקבילות לציר x). מצאי את שטחו. כתבי S=…",
    promptLatex: `${ptL("A", ...A)},\\ ${ptL("B", ...B)},\\ ${ptL("C", ...C)},\\ ${ptL("D", ...D)}`,
    finalLatex: `S=${nl(S0)}`,
    asks: [val("S", "שטח הטרפז – (בסיס+בסיס)·גובה חלקי 2", S0)],
    params: { S: S0, a: w, b: w2, h, [segKey("AB")]: w, [segKey("DC")]: w2, [segKey("CD")]: w2 },
    geoTraps: [
      { key: "S", value: (w + w2) * h, message: "שכחת לחלק ב-2. טרפז: סכום הבסיסים כפול הגובה, חלקי 2.", mistake: "area_half" },
      { key: "S", value: (w * h) / 2, message: "לקחת רק בסיס אחד. בטרפז מחברים את שני הבסיסים: (a+b)·h/2 – זה בנוסחאון.", mistake: "geo" },
    ],
    plot: { points: [{ x: A[0], y: A[1], label: "A" }, { x: B[0], y: B[1], label: "B" }, { x: C[0], y: C[1], label: "C" }, { x: D[0], y: D[1], label: "D" }], polygon: [A, B, C, D] },
    stages: [S("שני בסיסים וגובה", "טרפז: (בסיס + בסיס)·גובה חלקי 2. הבסיסים אופקיים – אורכם ההפרש ב-x. הגובה מאונך – ההפרש ב-y בין שני הישרים. פתחי נוסחאון אם צריך.", `AB=${w}, DC=${w2}, h=${h}. S=(${w}+${w2})·${h}/2=${num(S0)}`)],
    steps: [st(`S=\\frac{\\left(${w}+${w2}\\right)\\cdot${h}}{2}=${nl(S0)}`, 1, `בסיסים ${w} ו-${w2}, גובה ${h}.`)],
  };
}

export const GEO_GENERATORS: Record<string, (level: number) => Exercise> = {
  line_read: genLineRead,
  line_through: genLineThrough,
  parabola_features: genParabolaFeatures,
  parabola_line: genParabolaLine,
  distance_mid: genDistanceMid,
  slopes_perp: genSlopesPerp,
  triangle_area: genTriangleArea,
};
void gcd;
