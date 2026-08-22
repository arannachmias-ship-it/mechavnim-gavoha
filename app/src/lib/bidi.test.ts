import { describe, it, expect } from "vitest";
import { isolateMath } from "./bidi";

const LRI = "⁦";
const isolated = (s: string) => isolateMath(s).includes(LRI);
const cores = (s: string) => [...isolateMath(s).matchAll(/⁦([^⁩]*)⁩/g)].map((m) => m[1]);

describe("isolateMath – מה כן מבודדים", () => {
  it("ביטוי אלגברי עם רווחים סביב הסימנים – בלי בידוד הוא מתערבב", () => {
    expect(cores("הנוסחה (a±b)² = a² ± 2ab + b². לא לשכוח.")).toEqual(["(a±b)² = a² ± 2ab + b²."]);
  });
  it("זוג ביטויים מופרד בפסיק, כששני הצדדים ביטוי שלם", () => {
    expect(cores("מציבים: x=1, y=3. נשארה משוואה.")).toEqual(["x=1, y=3."]);
  });
  it("התאומים ההפוכים", () => {
    expect(isolated("שימי לב ש-(a+b)(a−b) = a²−b². זה הכלל.")).toBe(true);
  });
});

describe("isolateMath – מה אסור לבודד (מתהפך לקורא/ת עברית)", () => {
  it("סימן שהאופרנד שלו הוא המילה העברית שלפניו", () => {
    // הבאג שנגה ואבא ראו: "2 חתולים + 6 חתולים = 8 חתולים" נקרא "חתולים 6 + חתולים 8 ="
    expect(isolated("לספור חתולים: 2 חתולים + 6 חתולים = 8 חתולים.")).toBe(false);
  });
  it("מספר שנגרר מהמשפט העברי אל תוך הביטוי", () => {
    expect(isolated("איחוד משפחות: 8 חתולים פחות 3 = 5.")).toBe(false);
    expect(isolated("שורש 49 = 7.")).toBe(false);
  });
  it("סימן בסוף הריצה – האופרנד הימני הוא עברית", () => {
    expect(isolated("עמ' 58 שאלות 9–13 + הסברים מעמיקים")).toBe(false);
    expect(isolated("y = מה קורה כשלא זזת.")).toBe(false);
    expect(isolated("(כל x / אין x)")).toBe(false);
  });
  it("רשימת מכפלות של מספרים – הסדר הנכון הוא מימין לשמאל", () => {
    expect(isolated("ל-12 יש שלושה (1·12, 2·6, 3·4), ל-15 שניים.")).toBe(false);
  });
  it("מספר שלילי בתוך משפט – ממילא נקרא נכון", () => {
    expect(isolated("מקבלים -12 ולא -15.")).toBe(false);
  });
  it("מספור של סעיפים", () => {
    expect(isolated("אחר-כך: . 2) מחפשים זוג. 3)")).toBe(false);
  });
  it("פסיק שמפריד בין שני חלקי משפט עברי – לא כורכים את שני הצדדים יחד", () => {
    // "ל-x, y מתחת" – בידוד של "-x, y" היה מקפיץ את ה-y לפני ה-x
    expect(cores("מסודר: x מתחת ל-x, y מתחת ל-y).")).toEqual(["-y)."]);
  });
});

describe("isolateMath – שמירות", () => {
  it("לא נוגע בטקסט בלי מתמטיקה", () => {
    const s = "אבא בנה לך את זה. השיטה כאן היא השיטה שלו.";
    expect(isolateMath(s)).toBe(s);
  });
  it("לא מעבד פעמיים", () => {
    const once = isolateMath("הנוסחה (a±b)² = a² ± 2ab + b².");
    expect(isolateMath(once)).toBe(once);
  });
  it("מחרוזת ריקה", () => {
    expect(isolateMath("")).toBe("");
  });
});
