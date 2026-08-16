import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { recognizeExercises } from "@/lib/anthropic";
import { exerciseFromPhoto } from "@/lib/math/fromLatex";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST {image: base64, mediaType} → {items:[{latex, kind, task, note, exercise|unsupported}]} */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (profile !== "noga" && profile !== "tester") return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { image?: string; mediaType?: string };
  if (!body.image || body.image.length < 100) return NextResponse.json({ ok: false, error: "אין תמונה." }, { status: 400 });
  if (body.image.length > 6_000_000) return NextResponse.json({ ok: false, error: "התמונה גדולה מדי." }, { status: 413 });
  const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body.mediaType ?? "") ? body.mediaType! : "image/jpeg";
  try {
    const rec = await recognizeExercises(body.image, mediaType);
    const items = rec.items.map((it) => {
      const built = exerciseFromPhoto(it);
      if ("ex" in built) {
        // strip functions for the wire
        const { stageOf, ...ex } = built.ex;
        void stageOf;
        return { ...it, exercise: ex };
      }
      return { ...it, unsupported: built.unsupported };
    });
    return NextResponse.json({ ok: true, items, model: rec.model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NO_KEY") return NextResponse.json({ ok: false, error: "אין מפתח API שמור. אבא צריך להכניס אותו במסך ההורה." }, { status: 503 });
    if (msg === "PARSE") return NextResponse.json({ ok: false, error: "לא הצלחתי לקרוא את התמונה. נסי לצלם ישר, באור טוב, קרוב לתרגיל." }, { status: 502 });
    if (msg.startsWith("ANTHROPIC_401")) return NextResponse.json({ ok: false, error: "המפתח לא תקף יותר – אבא צריך להחליף אותו במסך ההורה." }, { status: 503 });
    if (msg.startsWith("ANTHROPIC_4")) return NextResponse.json({ ok: false, error: "אנתרופיק דחתה את הבקשה (" + msg.slice(0, 60) + "). אולי נגמר הקרדיט." }, { status: 502 });
    return NextResponse.json({ ok: false, error: "משהו השתבש בקריאת התמונה. נסי שוב." }, { status: 502 });
  }
}
