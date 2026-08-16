"use client";
import { useEffect, useState } from "react";
import { Math as M, RichText } from "./MathText";

interface Frame {
  latex: string;
  caption: string;
  emoji?: string;
}

const R = (c: string, s: string) => `\\color{${c}}{${s}}`;
const red = (s: string) => R("#dc2626", s);
const blue = (s: string) => R("#2563eb", s);
const green = (s: string) => R("#16a34a", s);
const purple = (s: string) => R("#7c3aed", s);
const gray = (s: string) => R("#9ca3af", s);

export const ANIMATIONS: Record<string, { title: string; frames: Frame[] }> = {
  kiss: {
    title: "הבחור עם המגנטים",
    frames: [
      { latex: `${red("-3")}\\left(x+y\\right)`, caption: "הבחור עם המגנטים עומד צמוד לסוגריים – זה אומר כפל.", emoji: "🧲" },
      { latex: `${red("-3")}\\left(${blue("x")}+y\\right)`, caption: "נשיקה ראשונה: $-3\\cdot x=-3x$", emoji: "💋" },
      { latex: `${red("-3")}\\left(x+${blue("y")}\\right)`, caption: "נשיקה שנייה: $-3\\cdot y=-3y$. אף אחד לא נשאר בלי!", emoji: "💋💋" },
      { latex: `${red("-3x")}${red("-3y")}`, caption: "פתחנו. שימי לב: המינוס נדבק לכולם.", emoji: "✅" },
      { latex: `-\\left(2y-2t\\right)`, caption: "טריק מלוכלך: מינוס לבד לפני סוגריים = $(-1)\\cdot$. הוא הופך את כולם.", emoji: "😈" },
      { latex: `${red("-2y")}${green("+2t")}`, caption: "$-\\cdot(+2y)=-2y$, $-\\cdot(-2t)=+2t$ (מינוס·מינוס = פלוס – נישואים של שני שליליים).", emoji: "💍" },
    ],
  },
  cats: {
    title: "איחוד משפחות",
    frames: [
      { latex: `3x+5y-2x+7-y`, caption: "ערימה של איברים. לפני שנוגעים – מסמנים משפחות.", emoji: "🐱🐶" },
      { latex: `${red("3x")}+${blue("5y")}${red("-2x")}+${green("7")}${blue("-y")}`, caption: "אדום = חתולים ($x$), כחול = כלבים ($y$), ירוק = מספרים.", emoji: "🖍️" },
      { latex: `${red("3x-2x")}+${blue("5y-y")}+${green("7")}`, caption: "כל אחד הולך עם המשפחה שלו.", emoji: "👨‍👩‍👧" },
      { latex: `${red("x")}+${blue("4y")}+${green("7")}`, caption: "3 חתולים פחות 2 = חתול אחד. 5 כלבים פחות 1 = 4. המספר נשאר לבד.", emoji: "✅" },
      { latex: `2\\sqrt{3}+2\\sqrt{3}=4\\sqrt{3}`, caption: "גם שורש הוא משפחה: שני כלבים ועוד שני כלבים = ארבעה כלבים.", emoji: "🐶🐶" },
    ],
  },
  gangs: {
    title: "כנופיות",
    frames: [
      { latex: `${green("8x")}${red("-3x")}`, caption: "8 חתולים טובים נגד 3 חתולים רעים.", emoji: "😇😈" },
      { latex: `${green("8")}\\ \\text{vs}\\ ${red("3")}`, caption: "רבים מכות. מי שיש לו יותר 'גב' מנצח – החיוביים.", emoji: "🥊" },
      { latex: `${green("+5x")}`, caption: "קודם סימן (פלוס), אחר-כך ההפרש (8−3=5).", emoji: "✅" },
      { latex: `${green("15")}${red("-45")}`, caption: "עכשיו: 15 טובים נגד 45 רעים.", emoji: "😇😈😈😈" },
      { latex: `${red("-30")}`, caption: "השליליים הביאו יותר חבר'ה → מינוס. ההפרש: מ-15 ל-45 – טיפוס של 30 קומות.", emoji: "🏢" },
    ],
  },
  vaad: {
    title: "ועד בית קומוניסטי",
    frames: [
      { latex: `\\frac{3x+21}{3}`, caption: "רוצים לצמצם – אבל למעלה יש חיבור. אסור לצמצם!", emoji: "🚫" },
      { latex: `\\frac{${red("3")}\\cdot x+${red("3")}\\cdot 7}{3}`, caption: "הוועד עובר דירה-דירה: מה כולם יכולים לתת? כולם יכולים לתת 3.", emoji: "🏢" },
      { latex: `\\frac{${red("3")}\\left(x+7\\right)}{3}`, caption: "הוועד לקח 3 מכולם והוציא החוצה. בסוגריים – מה שנשאר לכל דירה.", emoji: "☭" },
      { latex: `\\frac{${gray("3")}\\left(x+7\\right)}{${gray("3")}}`, caption: "עכשיו למעלה יש כפל – מותר לצמצם גוש שלם. פלאש-דאון!", emoji: "🚽" },
      { latex: `x+7`, caption: "נשאר $x+7$. בדיקה: $3(x+7)=3x+21$ ✔", emoji: "✅" },
      { latex: `2x^2-2x=2x\\left(x-${red("1")}\\right)`, caption: "אחד לזכרו: אם הוועד לקח מדירה את הכול – נשאר 1, לא כלום!", emoji: "🪦" },
    ],
  },
  mirror: {
    title: "ליברמן ומראת הקסמים",
    frames: [
      { latex: `10x-2=9x`, caption: "פרות ומספרים מעורבבים. ליברמן: את אלה פה ואת אלה פה.", emoji: "🐄" },
      { latex: `10x${red("-9x")}=${green("+2")}`, caption: "9x עובר שמאלה – דרך המראה הוא הופך למינוס. −2 עובר ימינה – הופך לפלוס.", emoji: "🪞" },
      { latex: `x=2`, caption: "10 פרות פחות 9 = פרה אחת. פרה עולה 2.", emoji: "✅" },
      { latex: `45+8x=3x+15`, caption: "שונא שליליים יחיה: לאיזה צד להעביר איקסים? לצד שבו יש יותר – שם הם יצאו חיוביים.", emoji: "😤" },
      { latex: `8x${red("-3x")}=15${red("-45")}`, caption: "האיקסים נשארים משמאל (8 > 3). 3x עובר ומתהפך, 45 עובר ומתהפך.", emoji: "🪞" },
      { latex: `5x=-30\\ \\Rightarrow\\ x=-6`, caption: "כפל עובר צד והופך לחילוק.", emoji: "✅" },
    ],
  },
  gulag: {
    title: "גולאג – סטאלין",
    frames: [
      { latex: `\\begin{cases}2x+${red("y")}=6\\\\x+${red("y")}=2\\end{cases}`, caption: "רוצים את x. y הוא הבעיה. יש נעלם – יש בעיה.", emoji: "☭" },
      { latex: `\\begin{cases}2x${red("+y")}=6\\\\x${red("+y")}=2\\end{cases}`, caption: "אותו סימן (+y, +y) → מחסרים. שמים סכין ביניהם.", emoji: "🔪" },
      { latex: `2x-x+${gray("(y-y)")}=6-2`, caption: "שורה מול שורה: x מתחת ל-x, y מתחת ל-y.", emoji: "📏" },
      { latex: `x=4`, caption: "אין נעלם – אין בעיה. y חוסל, x נשאר.", emoji: "✅" },
      { latex: `\\begin{cases}2x${green("+3y")}=4\\\\3x${red("-3y")}=6\\end{cases}`, caption: "סימנים הפוכים → מחברים: הכנופיות נפגשות ומחסלות זו את זו.", emoji: "💥" },
      { latex: `5x=10\\ \\Rightarrow\\ x=2`, caption: "ואם המקדמים שונים (y ו-3y)? עבודת הכנה: מכפילים משוואה שלמה – גם את הצד הימני!", emoji: "🚗" },
    ],
  },
  finger: {
    title: "האצבע",
    frames: [
      { latex: `\\left(x+3\\right)^{2}`, caption: "ריבוע של סוגריים. לא לפתוח 4 נשיקות – יש קיצור: האצבע.", emoji: "☝️" },
      { latex: `\\left(x+${gray("3")}\\right)^{2}\\to ${red("x^{2}")}`, caption: "מסתירים את 3 עם האצבע → $x^2$.", emoji: "🫣" },
      { latex: `\\left(x+3\\right)^{2}\\to ${blue("2\\cdot x\\cdot 3=6x")}`, caption: "מרימים את האצבע → כפליים המכפלה: $2\\cdot x\\cdot 3$.", emoji: "☝️" },
      { latex: `\\left(${gray("x")}+3\\right)^{2}\\to ${green("9")}`, caption: "מסתירים את x → $3^2=9$.", emoji: "🫣" },
      { latex: `${red("x^{2}")}+${blue("6x")}+${green("9")}`, caption: "תמיד שלושה איברים! $(x+3)^2$ הוא לא $x^2+9$.", emoji: "✅" },
    ],
  },
  couple: {
    title: "הזוג שמסתדר",
    frames: [
      { latex: `x^{2}+12x+32`, caption: "טרינום. מחפשים זוג מספרים.", emoji: "💑" },
      { latex: `\\text{מכפלה: }${red("32")}\\quad\\text{סכום: }${blue("12")}`, caption: "קודם המכפלה – מי המועמדים? 1·32, 2·16, 4·8.", emoji: "🔍" },
      { latex: `4\\cdot 8=32\\quad 4+8=12\\ ✔`, caption: "מי מתחתן עם מי? 4 ו-8 – גם המכפלה וגם הסכום מסתדרים.", emoji: "💍" },
      { latex: `\\left(x+4\\right)\\left(x+8\\right)`, caption: "כל אחד מבני הזוג נכנס לסוגריים משלו. בדיקה: 4 נשיקות חזרה.", emoji: "✅" },
    ],
  },
};

export default function Animation({ id }: { id: string }) {
  const anim = ANIMATIONS[id];
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !anim) return;
    const t = setTimeout(() => setI((k) => (k + 1 < anim.frames.length ? k + 1 : (setPlaying(false), k))), 2600);
    return () => clearTimeout(t);
  }, [playing, i, anim]);
  if (!anim) return null;
  const f = anim.frames[i];
  return (
    <div className="card bg-gradient-to-br from-white to-amber-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">🎬 {anim.title}</h3>
        <span className="text-sm text-slate-500">
          {i + 1}/{anim.frames.length}
        </span>
      </div>
      <div className="min-h-[70px] flex items-center justify-center py-3">
        <div key={i} className="animate-pop text-2xl">
          <M latex={f.latex} block />
        </div>
      </div>
      <div className="flex items-start gap-3 min-h-[60px]">
        <span className="text-3xl animate-floaty">{f.emoji}</span>
        <p className="text-slate-700 leading-relaxed">
          <RichText text={f.caption} />
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn-soft" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0}>
          → הקודם
        </button>
        <button className="btn-primary" onClick={() => (i + 1 < anim.frames.length ? setI(i + 1) : setI(0))}>
          {i + 1 < anim.frames.length ? "הבא ←" : "מהתחלה ↺"}
        </button>
        <button className="btn-ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? "⏸ עצור" : "▶ נגן"}
        </button>
      </div>
    </div>
  );
}
