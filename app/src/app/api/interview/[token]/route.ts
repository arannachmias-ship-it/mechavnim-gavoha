import { NextResponse } from "next/server";
import { z } from "zod";
import { getInterview, updateInterview, type InterviewMsg } from "@/lib/db";
import { chat } from "@/lib/anthropic";
import { INTERVIEW_SYSTEM, SUMMARY_SYSTEM, END_MARK, MAX_TURNS, toApiMessages, transcriptText } from "@/lib/interview";

export const dynamic = "force-dynamic";

/** GET – מצב הראיון (בלי כניסה: הטוקן הוא הסוד) */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const iv = await getInterview(token);
  if (!iv) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, status: iv.status, title: iv.title, messages: iv.messages });
}

const bodySchema = z.object({ text: z.string().max(2000).optional(), action: z.enum(["start", "say", "finish"]).optional() });

/** POST – תור בשיחה: start (שאלה ראשונה) / say {text} / finish (סיכום) */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const iv = await getInterview(token);
  if (!iv) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  const { text, action = "say" } = parsed.data;
  if (iv.status === "done" && action !== "finish") return NextResponse.json({ ok: true, done: true, messages: iv.messages, summary: iv.summary });

  const msgs: InterviewMsg[] = [...iv.messages];
  const now = () => new Date().toISOString();

  try {
    if (action === "finish") {
      return await finish(token, msgs);
    }
    if (action === "start") {
      if (msgs.length) return NextResponse.json({ ok: true, messages: msgs, status: iv.status });
    } else {
      const t = (text ?? "").trim();
      if (!t) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
      msgs.push({ role: "user", text: t, at: now() });
    }
    if (msgs.filter((m) => m.role === "user").length > MAX_TURNS) return await finish(token, msgs);

    const reply = await chat(INTERVIEW_SYSTEM, toApiMessages(msgs), { maxTokens: 400, temperature: 0.7 });
    let replyText = reply.text;
    const ended = replyText.includes(END_MARK);
    replyText = replyText.replace(END_MARK, "").trim();
    msgs.push({ role: "assistant", text: replyText, at: now() });
    await updateInterview(token, { messages: msgs });
    if (ended) return await finish(token, msgs);
    return NextResponse.json({ ok: true, messages: msgs, status: "open" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NO_KEY") return NextResponse.json({ ok: false, error: "no_key" }, { status: 503 });
    return NextResponse.json({ ok: false, error: msg.slice(0, 120) }, { status: 502 });
  }
}

async function finish(token: string, msgs: InterviewMsg[]) {
  let summary: string | null = null;
  const userTurns = msgs.filter((m) => m.role === "user").length;
  if (userTurns >= 2) {
    try {
      const transcript = transcriptText("ראיון עם נגה", msgs);
      const r = await chat(SUMMARY_SYSTEM, [{ role: "user", content: `התמלול:\n\n${transcript}\n\nכתבי את סיכום הממצאים.` }], { maxTokens: 1500, temperature: 0.3 });
      summary = r.text;
    } catch {
      summary = null;
    }
  }
  await updateInterview(token, { messages: msgs, status: "done", summary });
  return NextResponse.json({ ok: true, done: true, messages: msgs, summary, status: "done" });
}
