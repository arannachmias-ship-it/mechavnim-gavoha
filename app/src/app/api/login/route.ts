import { NextResponse } from "next/server";
import { PROFILE_COOKIE, parentPin } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { profile?: string; pin?: string };
  if (body.profile === "noga") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PROFILE_COOKIE, "noga", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return res;
  }
  if (body.profile === "parent") {
    if (body.pin !== parentPin()) return NextResponse.json({ ok: false, error: "קוד שגוי" }, { status: 401 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PROFILE_COOKIE, "parent", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PROFILE_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
