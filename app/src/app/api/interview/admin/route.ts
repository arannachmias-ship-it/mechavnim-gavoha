import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getProfile } from "@/lib/auth";
import { createInterview, listInterviews, deleteInterview } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET – רשימת הראיונות (הורה בלבד) */
export async function GET() {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const items = await listInterviews();
  return NextResponse.json({ ok: true, items });
}

/** POST – יוצר ראיון חדש עם לינק סודי */
export async function POST(req: Request) {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const token = randomBytes(18).toString("base64url");
  const title = (body.title ?? "").trim() || `ראיון עם נגה – ${new Date().toLocaleDateString("he-IL")}`;
  const row = await createInterview(token, title);
  return NextResponse.json({ ok: true, item: row });
}

export async function DELETE(req: Request) {
  if ((await getProfile()) !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  await deleteInterview(token);
  return NextResponse.json({ ok: true });
}
