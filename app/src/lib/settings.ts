/**
 * הגדרות מוצפנות (למשל מפתח API של אנתרופיק).
 * הצפנה: AES-256-GCM עם מפתח שנגזר מ-SETTINGS_SECRET (משתנה סביבה ב-Vercel).
 * הערך המוצפן נשמר ב-Neon בטבלת settings. המפתח עצמו אף פעם לא נשמר גלוי.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSetting, setSetting, deleteSetting } from "./db";

function aesKey(): Buffer {
  const secret = process.env.SETTINGS_SECRET ?? `${process.env.PARENT_PIN ?? ""}|${process.env.DATABASE_URL ?? "dev"}`;
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(blob: string): string | null {
  try {
    const [v, iv, tag, enc] = blob.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const ANTHROPIC_KEY = "anthropic_api_key";

export async function getAnthropicKey(): Promise<string | null> {
  const row = await getSetting(ANTHROPIC_KEY);
  return row ? decrypt(row.value) : null;
}

export async function saveAnthropicKey(key: string) {
  await setSetting(ANTHROPIC_KEY, encrypt(key));
}

export async function clearAnthropicKey() {
  await deleteSetting(ANTHROPIC_KEY);
}

/** מטא-נתונים בלבד – בלי הערך */
export async function anthropicKeyStatus(): Promise<{ hasKey: boolean; last4?: string; updatedAt?: string }> {
  const row = await getSetting(ANTHROPIC_KEY);
  if (!row) return { hasKey: false };
  const k = decrypt(row.value);
  return { hasKey: !!k, last4: k ? k.slice(-4) : undefined, updatedAt: row.updated_at };
}

/** בדיקה שהמפתח תקף – קריאה חינמית לרשימת המודלים */
export async function verifyAnthropicKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, error: "המפתח לא מזוהה (401). בדוק שהעתקת אותו במלואו." };
    if (r.status === 403) return { ok: false, error: "המפתח מזוהה אבל אין לו הרשאה (403) – אולי צריך לטעון קרדיט בקונסולה." };
    return { ok: false, error: `אנתרופיק החזירה ${r.status}.` };
  } catch {
    return { ok: false, error: "לא הצלחתי להגיע ל-api.anthropic.com מהשרת." };
  }
}
