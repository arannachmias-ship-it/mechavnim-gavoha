import { NextResponse } from "next/server";
import { z } from "zod";
import { insertAttempt } from "@/lib/db";
import { getProfile } from "@/lib/auth";

const schema = z.object({
  type_id: z.string(),
  topic_id: z.string(),
  level: z.number().int().min(1).max(3),
  correct: z.boolean(),
  hints: z.number().int().min(0),
  reveals: z.number().int().min(0),
  wrong_lines: z.number().int().min(0),
  duration_sec: z.number().int().min(0).max(3600),
  lines: z.array(z.string()).max(40),
  prompt: z.string().max(500),
  mistakes: z.array(z.string()).max(20),
  first_input_sec: z.number().int().min(0).max(3600).nullable().optional(),
  skipped: z.boolean().optional(),
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (profile === "tester") return NextResponse.json({ ok: true, ignored: true }); // מצב בדיקה – לא נרשם
  if (profile !== "noga") return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  await insertAttempt({ ...parsed.data, first_input_sec: parsed.data.first_input_sec ?? null, skipped: parsed.data.skipped ?? false, profile });
  return NextResponse.json({ ok: true });
}
