import { describe, it, expect } from "vitest";
import { TOPICS, ALL_TYPES } from "./topics";
import { FORMULAS } from "./formulas";
import { generate } from "@/lib/math/generators";
import { geoChecklist } from "@/lib/math/geo";

/**
 * 🔤 סימון מתמטי בטקסט: מה שמוצג דרך <Txt> נכתב כטקסט רגיל, בלי $…$,
 * אחרת הסימנים נראים על המסך כמו שהם ("המקדם של $x^2$ אינו 1").
 * מה שכן מכיל $ חייב להיות מוצג דרך <RichText> – כרגע רק כותרות של כרטיסים.
 */
const plain = (label: string, s: string | undefined, bad: string[]) => {
  if (s && s.includes("$")) bad.push(`${label}: ${s}`);
};

describe("סימון מתמטי בטקסט תצוגה", () => {
  it("שדות שמוצגים כטקסט רגיל – בלי $ גולמי", () => {
    const bad: string[] = [];
    for (const t of TOPICS) {
      plain("topic.title", t.title, bad);
      plain("topic.subtitle", t.subtitle, bad);
      for (const ty of t.types) {
        plain("type.title", ty.title, bad);
        plain("type.short", ty.short, bad);
      }
    }
    for (const g of FORMULAS) for (const item of g.items) plain("formula.note", item.note, bad);
    for (const ty of ALL_TYPES) {
      for (const lv of [1, 2, 3] as const) {
        for (let i = 0; i < 8; i++) {
          const ex = generate(ty.id, lv);
          if (!ex) continue;
          plain(`instruction[${ty.id}]`, ex.instruction, bad);
          for (const s of ex.stages ?? []) plain(`stage.name[${ty.id}]`, s.name, bad);
          if (ex.kind === "geo") for (const c of geoChecklist(ex, [])) plain(`geo.label[${ty.id}]`, c.label, bad);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("כותרות כרטיסים – כל $ נפתח ונסגר (הן מוצגות דרך RichText)", () => {
    for (const t of TOPICS) {
      for (const c of t.cards) {
        const n = (c.title.match(/\$/g) ?? []).length;
        expect(n % 2, `כותרת עם $ לא סגור: ${c.title}`).toBe(0);
        for (const m of c.title.match(/\$[^$]*\$/g) ?? []) expect(m.length, `נוסחה ריקה בכותרת: ${c.title}`).toBeGreaterThan(2);
      }
    }
  });
});
