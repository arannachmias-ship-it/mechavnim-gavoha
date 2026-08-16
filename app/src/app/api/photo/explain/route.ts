import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { explainInMethod } from "@/lib/anthropic";
import { METHOD_SUMMARY } from "@/content/method_summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** רשת ביטחון: הסבר AI בשיטה (ללא בדיקה) לתרגיל שהמנוע לא מלווה */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (profile !== "noga" && profile !== "tester") return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { latex?: string };
  const latex = (body.latex ?? "").trim().slice(0, 500);
  if (!latex) return NextResponse.json({ ok: false, error: "אין תרגיל." }, { status: 400 });
  try {
    const r = await explainInMethod(latex, METHOD_SUMMARY);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg === "NO_KEY" ? "אין מפתח API שמור." : "לא הצלחתי לקבל הסבר כרגע." }, { status: 502 });
  }
}
