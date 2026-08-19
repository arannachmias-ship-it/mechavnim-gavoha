import { NextResponse } from "next/server";
import { listAttempts, getSetting, setSetting } from "@/lib/db";
import { getProfile } from "@/lib/auth";
import { summarize } from "@/lib/progress";
import { buildPlan, normalizeSettings, PLAN_SETTING_KEY, DEFAULT_PLAN } from "@/lib/plan";

export const dynamic = "force-dynamic";

async function loadSettings() {
  const row = await getSetting(PLAN_SETTING_KEY);
  if (!row) return DEFAULT_PLAN;
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_PLAN;
  }
}

/** GET /api/plan – התוכנית המחושבת (לנגה ולהורה) */
export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
  const settings = await loadSettings();
  const rows = profile === "tester" ? [] : await listAttempts("noga");
  const plan = buildPlan(rows, summarize(rows), settings);
  return NextResponse.json({ ok: true, plan, profile });
}

/** PUT /api/plan – עדכון הגדרות (הורה בלבד) */
export async function PUT(req: Request) {
  const profile = await getProfile();
  if (profile !== "parent") return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const current = await loadSettings();
  const next = normalizeSettings({ ...current, ...(body && typeof body === "object" ? body : {}) });
  await setSetting(PLAN_SETTING_KEY, JSON.stringify(next));
  const rows = await listAttempts("noga");
  const plan = buildPlan(rows, summarize(rows), next);
  return NextResponse.json({ ok: true, plan });
}
