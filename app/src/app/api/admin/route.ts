import { NextResponse } from "next/server";
import { deleteAttempts } from "@/lib/db";
import { getProfile } from "@/lib/auth";

/** DELETE /api/admin – מוחק את כל נתוני התרגול של נגה. הורה בלבד. */
export async function DELETE() {
  const profile = await getProfile();
  if (profile !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const n = await deleteAttempts("noga");
  return NextResponse.json({ ok: true, deleted: n });
}
