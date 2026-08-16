/**
 * נוסחאון – לפי דף הנוסחאות הרשמי של משרד החינוך לבחינת הבגרות ב-4 יח"ל
 * (meyda.education.gov.il/files/Pop/0files/matmatika/Chativa-Elyona/new-curriculum/4-MATH-Formula_NEW.pdf).
 * הניסוח והסימונים כמו בדף המקורי. החלקים הרלוונטיים לכיתה י' פתוחים; השאר מקופל.
 */
export interface FormulaSection {
  id: string;
  title: string;
  now: boolean; // רלוונטי עכשיו (כיתה י')
  items: { latex: string; note?: string }[];
}

export const FORMULAS: FormulaSection[] = [
  {
    id: "algebra",
    title: "אלגברה",
    now: true,
    items: [
      { latex: "(a+b)^2=a^2+2ab+b^2", note: "כפל מקוצר – האצבע" },
      { latex: "(a-b)^2=a^2-2ab+b^2" },
      { latex: "(a+b)(a-b)=a^2-b^2", note: "התאומים ההפוכים" },
      { latex: "x_{1,2}=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}", note: "נוסחת השורשים ל-ax²+bx+c=0 – שלוש שורות a, b, c לפני שנוגעים" },
    ],
  },
  {
    id: "powers",
    title: "חוקי חזקות",
    now: true,
    items: [
      { latex: "a^x\\cdot a^y=a^{x+y}" },
      { latex: "\\dfrac{a^x}{a^y}=a^{x-y}" },
      { latex: "(a^x)^y=a^{xy}" },
      { latex: "(ab)^x=a^x b^x" },
      { latex: "a^{-x}=\\dfrac{1}{a^x}" },
      { latex: "a^0=1\\ (a\\ne0)" },
    ],
  },
  {
    id: "analytic",
    title: "גאומטריה אנליטית",
    now: true,
    items: [
      { latex: "m=\\dfrac{y_2-y_1}{x_2-x_1}", note: "שיפוע – כמה קומות על כל צעד" },
      { latex: "y-y_1=m(x-x_1)", note: "משוואת ישר דרך נקודה" },
      { latex: "M=\\left(\\dfrac{x_1+x_2}{2},\\ \\dfrac{y_1+y_2}{2}\\right)", note: "אמצע קטע – ממוצע האיקסים, ממוצע הוואיים" },
      { latex: "d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}", note: "מרחק בין נקודות – זה פיתגורס" },
      { latex: "m_1\\cdot m_2=-1", note: "ישרים מאונכים – הפוך והפוך" },
      { latex: "(x-a)^2+(y-b)^2=R^2", note: "מעגל שמרכזו (a,b)" },
      { latex: "\\tan\\alpha=m", note: "זווית בין ישר לציר x" },
    ],
  },
  {
    id: "geometry",
    title: "גאומטריה במישור",
    now: true,
    items: [
      { latex: "S_{\\triangle}=\\dfrac{a\\cdot h}{2}" },
      { latex: "S_{\\text{מקבילית}}=a\\cdot h" },
      { latex: "S_{\\text{טרפז}}=\\dfrac{(a+b)\\cdot h}{2}" },
      { latex: "S_{\\bigcirc}=\\pi R^2,\\quad P=2\\pi R" },
      { latex: "c^2=a^2+b^2", note: "פיתגורס" },
    ],
  },
  {
    id: "seq",
    title: "סדרות",
    now: false,
    items: [
      { latex: "a_n=a_1+(n-1)d,\\quad S_n=\\dfrac{n(a_1+a_n)}{2}", note: "חשבונית" },
      { latex: "a_n=a_1\\cdot q^{n-1},\\quad S_n=a_1\\cdot\\dfrac{q^n-1}{q-1},\\quad S=\\dfrac{a_1}{1-q}\\ (|q|<1)", note: "הנדסית" },
      { latex: "f(t)=f_0\\cdot q^t,\\quad q=1\\pm\\dfrac{p}{100}", note: "גדילה ודעיכה" },
    ],
  },
  {
    id: "trig",
    title: "טריגונומטריה",
    now: false,
    items: [
      { latex: "\\sin\\alpha=\\dfrac{a}{c},\\ \\cos\\alpha=\\dfrac{b}{c},\\ \\tan\\alpha=\\dfrac{a}{b}" },
      { latex: "\\sin(90^\\circ-\\alpha)=\\cos\\alpha,\\ \\cos(90^\\circ-\\alpha)=\\sin\\alpha" },
      { latex: "\\sin(180^\\circ-\\alpha)=\\sin\\alpha,\\ \\cos(180^\\circ-\\alpha)=-\\cos\\alpha" },
      { latex: "\\dfrac{a}{\\sin\\alpha}=\\dfrac{b}{\\sin\\beta}=\\dfrac{c}{\\sin\\gamma}=2R", note: "משפט הסינוסים" },
      { latex: "S=\\dfrac{1}{2}bc\\sin\\alpha" },
    ],
  },
  {
    id: "solid",
    title: "גאומטריה במרחב",
    now: false,
    items: [
      { latex: "V_{\\text{מנסרה}}=S\\cdot h,\\quad V_{\\text{פירמידה}}=\\dfrac{1}{3}S\\cdot h" },
      { latex: "F_{\\text{מנסרה}}=2S+M,\\quad F_{\\text{פירמידה}}=S+M" },
    ],
  },
  {
    id: "calc",
    title: "חשבון דיפרנציאלי ואינטגרלי",
    now: false,
    items: [
      { latex: "(x^t)'=t x^{t-1},\\quad (e^x)'=e^x,\\quad (\\ln x)'=\\dfrac{1}{x}" },
      { latex: "(f\\cdot g)'=f'g+fg',\\quad \\left(\\dfrac{f}{g}\\right)'=\\dfrac{f'g-fg'}{g^2}" },
      { latex: "\\int x^t\\,dx=\\dfrac{x^{t+1}}{t+1}+C\\ (t\\ne-1),\\quad \\int e^x\\,dx=e^x+C" },
    ],
  },
  {
    id: "stat",
    title: "הסתברות וסטטיסטיקה",
    now: false,
    items: [
      { latex: "P(A|B)=\\dfrac{P(A\\cap B)}{P(B)},\\quad P(A\\cap B)=P(A)\\cdot P(B)\\ \\text{(בלתי תלויים)}" },
      { latex: "\\bar{x}=\\dfrac{f_1x_1+\\dots+f_nx_n}{N},\\quad z=\\dfrac{x-\\bar{x}}{S}" },
    ],
  },
];
