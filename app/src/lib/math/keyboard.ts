/**
 * פריסת המקלדת המתמטית. מוגדרת בנפרד מהרכיב כדי שאפשר יהיה לבדוק אותה
 * בבדיקות אוטומטיות: מובטח שכל אות שמופיעה בתרגיל מקבלת מקש.
 */
import { keyboardVariables, DEFAULT_KEYBOARD_VARS } from "./vars";

export interface KeyDef {
  latex?: string;
  label?: string;
  insert?: string;
  command?: string[];
  class?: string;
  variants?: string[];
}

/** בונה את פריסת המקלדת סביב האותיות של התרגיל */
export function buildLayout(variables: string[] = []): { label: string; displayEditToolbar: boolean; rows: KeyDef[][] }[] {
  const v = keyboardVariables(variables);
  const main = v.slice(0, 6);
  const extra = v.slice(6); // תרגיל עם הרבה נעלמים – מוסיפים מקשים, לא מוותרים על אף אות
  const varKey = (letter: string) => ({
    latex: letter,
    variants: [...v.filter((o) => o !== letter), ...DEFAULT_KEYBOARD_VARS.filter((o) => !v.includes(o))],
  });
  return [
    {
      label: "מקלדת",
      displayEditToolbar: false,
      rows: [
        [
          varKey(main[0]),
          varKey(main[1]),
          { label: "7", latex: "7" },
          { label: "8", latex: "8" },
          { label: "9", latex: "9" },
          { label: "÷", insert: "\\frac{#@}{#?}" },
          { label: "(", latex: "(" },
          { label: ")", latex: ")" },
          /* סגירת המקלדת – בלעדיו היא נשארת פתוחה ומסתירה את התרגיל */
          { label: "⌄", command: ["hideVirtualKeyboard"], class: "action key-hide-kb" },
        ],
        [
          { latex: "#@^{2}", label: "x²", insert: "#@^{2}" },
          { latex: "#@^{#?}", label: "xⁿ", insert: "#@^{#?}" },
          { label: "4", latex: "4" },
          { label: "5", latex: "5" },
          { label: "6", latex: "6" },
          { label: "×", latex: "\\cdot" },
          { label: "√", insert: "\\sqrt{#0}" },
          { label: "⌫", command: ["deleteBackward"], class: "action w15" },
        ],
        [
          varKey(main[2]),
          varKey(main[3]),
          { label: "1", latex: "1" },
          { label: "2", latex: "2" },
          { label: "3", latex: "3" },
          /* המינוס של נגה: מקש כפול-רוחב, כהה ובולט – שלא יילחץ בטעות ולא יתפספס */
          { label: "−", latex: "-", class: "w20 key-minus" },
          { label: "←", command: ["moveToPreviousChar"], class: "action" },
          { label: "→", command: ["moveToNextChar"], class: "action" },
          ...extra.map(varKey),
        ],
        [
          varKey(main[4]),
          varKey(main[5]),
          { label: "0", latex: "0" },
          { label: ".", latex: "." },
          { label: "=", latex: "=" },
          { label: "+", latex: "+" },
          { label: ",", latex: ",", variants: ["\\ne", "\\pm"] },
          { label: "≠", latex: "\\ne" },
          { label: "↵", command: ["commit"], class: "action key-commit" },
        ],
      ],
    },
  ];
}
