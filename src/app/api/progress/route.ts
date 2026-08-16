import { NextResponse } from "next/server";
import { listAttempts } from "@/lib/db";
import { getProfile } from "@/lib/auth";
import { summarize } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await listAttempts("noga");
  const s = summarize(rows);
  if (profile !== "parent") s.recent = s.recent.slice(0, 5);
  return NextResponse.json({ ok: true, summary: s });
}
