import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { anthropicKeyStatus, saveAnthropicKey, clearAnthropicKey, verifyAnthropicKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET – סטטוס בלבד (יש/אין, 4 תווים אחרונים). הורה בלבד. */
export async function GET() {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await anthropicKeyStatus()) });
}

/** POST {key} – מאמת מול אנתרופיק ושומר מוצפן. */
export async function POST(req: Request) {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = (body.key ?? "").trim();
  if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) return NextResponse.json({ ok: false, error: "זה לא נראה כמו מפתח של אנתרופיק (צריך להתחיל ב-sk-ant-)." }, { status: 400 });
  const v = await verifyAnthropicKey(key);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  await saveAnthropicKey(key);
  return NextResponse.json({ ok: true, ...(await anthropicKeyStatus()) });
}

export async function DELETE() {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  await clearAnthropicKey();
  return NextResponse.json({ ok: true });
}
