/**
 * קריאות ל-Anthropic (רק מהשרת). המפתח נטען מוצפן מבסיס הנתונים.
 * שימוש 1: קריאת תמונה של תרגיל → LaTeX (המודל רק "קורא"; הבדיקה נשארת דטרמיניסטית).
 * שימוש 2 (רשת ביטחון): הסבר בשיטה של אבא לתרגיל שהמנוע עוד לא יודע ללוות – מסומן כ-AI.
 */
import { getAnthropicKey } from "./settings";
import { getSetting, setSetting } from "./db";

const API = "https://api.anthropic.com/v1";
const VERSION = "2023-06-01";

let modelCache: { id: string; at: number } | null = null;

/** בוחר מודל: המודל ה-Sonnet החדש ביותר הזמין למפתח (יציב, זול, טוב בראייה). */
export async function pickModel(key: string): Promise<string> {
  if (modelCache && Date.now() - modelCache.at < 6 * 3600e3) return modelCache.id;
  const saved = await getSetting("anthropic_model");
  if (saved && Date.now() - new Date(saved.updated_at).getTime() < 24 * 3600e3) {
    modelCache = { id: saved.value, at: Date.now() };
    return saved.value;
  }
  let id = "claude-sonnet-4-5";
  try {
    const r = await fetch(`${API}/models?limit=100`, { headers: { "x-api-key": key, "anthropic-version": VERSION }, cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { data?: { id: string; created_at?: string }[] };
      const ids = (j.data ?? []).map((m) => m.id);
      const sonnets = ids.filter((m) => /sonnet/.test(m)).sort((a, b) => (verKey(b) > verKey(a) ? 1 : -1));
      if (sonnets.length) id = sonnets[0];
      else if (ids.length) id = ids[0];
    }
  } catch {
    /* fallback */
  }
  modelCache = { id, at: Date.now() };
  await setSetting("anthropic_model", id).catch(() => {});
  return id;
}
function verKey(id: string) {
  const m = id.match(/(\d+)(?:[-.](\d+))?/g);
  return (m ?? []).map((x) => x.replace(/[-.]/, ".").padStart(6, "0")).join(".");
}

export interface RecognizedItem {
  latex: string;
  kind: "expr" | "equation" | "system" | "other";
  task: "simplify" | "expand" | "factor" | "solve" | "compute" | "other";
  equations?: string[];
  note?: string;
}

const RECOGNIZE_PROMPT = `You read a photo of a math homework page (Israeli 10th grade, "4 units"). Extract every distinct exercise visible.
Return ONLY a JSON object: {"items":[{"latex": "...", "kind": "expr|equation|system|other", "task": "simplify|expand|factor|solve|compute|other", "equations": ["...","..."], "note": "..."}]}
Rules:
- "latex": clean LaTeX of the exercise itself (no exercise numbers, no Hebrew instructions). Use \\frac, \\left( \\right), ^{}, \\cdot. Keep Israeli division sign ':' as ':' if present.
- "kind": expr = expression to simplify/expand/factor/compute; equation = single equation with '='; system = two or more equations (also fill "equations" as separate LaTeX strings); other = word problem / geometry / anything else.
- "task": infer from the Hebrew instruction near it (פשט/פתח סוגריים → expand or simplify; פרק לגורמים → factor; פתור → solve; חשב → compute). If unknown → other.
- "note": one short Hebrew line only if something is unclear (handwriting, cut off).
- If the page shows a student's solution as well, extract only the ORIGINAL exercise, not the work.
No prose, no markdown fences – JSON only.`;

export async function recognizeExercises(imageBase64: string, mediaType: string): Promise<{ items: RecognizedItem[]; model: string; usage?: unknown }> {
  const key = await getAnthropicKey();
  if (!key) throw new Error("NO_KEY");
  const model = await pickModel(key);
  const body = {
    model,
    max_tokens: 1200,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: RECOGNIZE_PROMPT },
        ],
      },
    ],
  };
  const r = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": VERSION, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`ANTHROPIC_${r.status}:${t.slice(0, 200)}`);
  }
  const j = (await r.json()) as { content: { type: string; text?: string }[]; usage?: unknown };
  const text = j.content.map((c) => c.text ?? "").join("");
  const jsonText = text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
  let parsed: { items?: RecognizedItem[] } = {};
  try {
    parsed = JSON.parse(jsonText.slice(jsonText.indexOf("{"), jsonText.lastIndexOf("}") + 1));
  } catch {
    throw new Error("PARSE");
  }
  const items = (parsed.items ?? []).filter((it) => it && typeof it.latex === "string" && it.latex.trim()).slice(0, 12);
  return { items, model, usage: j.usage };
}

/** רשת ביטחון: הסבר בשיטה של אבא (ללא בדיקה). מסומן כ-AI. */
export async function explainInMethod(latex: string, methodDictionary: string): Promise<{ text: string; model: string }> {
  const key = await getAnthropicKey();
  if (!key) throw new Error("NO_KEY");
  const model = await pickModel(key);
  const prompt = `אתה מלווה תלמידת כיתה י' (4 יח"ל) בפתרון תרגיל, בשיטה ובשפה של אבא שלה. הנה מילון השיטה – השתמש רק בדימויים האלה, בלשון נקבה, קצר וברור:
${methodDictionary}

התרגיל: $${latex}$

כתוב הדרכה בעברית, שלב אחרי שלב, כשכל שלב הוא: מה עושים עכשיו + איזה דימוי מהשיטה מסביר את זה + השורה המתמטית שמתקבלת (ב-LaTeX בין $...$). אל תדלג על שלבים. בסוף – התשובה, ואיך בודקים אותה בהצבה. אל תוסיף מחמאות ואל תסביר על עצמך. עד 12 שלבים.`;
  const r = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": VERSION, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1800, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`ANTHROPIC_${r.status}`);
  const j = (await r.json()) as { content: { type: string; text?: string }[] };
  return { text: j.content.map((c) => c.text ?? "").join(""), model };
}

/** שיחה כללית (למשל ראיון משתמש): system + היסטוריה → תשובת טקסט */
export async function chat(system: string, messages: { role: "user" | "assistant"; content: string }[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<{ text: string; model: string }> {
  const key = await getAnthropicKey();
  if (!key) throw new Error("NO_KEY");
  const model = await pickModel(key);
  const r = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": VERSION, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 600, temperature: opts.temperature ?? 0.6, system, messages }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`ANTHROPIC_${r.status}:${t.slice(0, 200)}`);
  }
  const j = (await r.json()) as { content: { type: string; text?: string }[] };
  return { text: j.content.map((c) => c.text ?? "").join("").trim(), model };
}
