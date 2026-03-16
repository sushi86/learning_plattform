import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessPage, canUseAi } from "@/lib/permissions";
import { getAiProvider } from "@/lib/ai/provider";
import { buildExplainPrompt } from "@/lib/ai/prompts";
import { aiRateLimiter } from "@/lib/ai/rate-limit";
import type { AiExplainContext } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  if (!canUseAi({ aiEnabled: session.user.aiEnabled })) {
    return NextResponse.json(
      { error: "KI-Funktionen sind noch nicht freigeschaltet. Kontaktiere den Betreiber." },
      { status: 403 },
    );
  }

  if (!aiRateLimiter.check(session.user.id)) {
    return NextResponse.json({ error: "Zu viele Anfragen. Warte kurz." }, { status: 429 });
  }

  const body = await req.json();
  const { image, previousSteps, step, question, pageId } = body as {
    image: string;
    previousSteps: { text: string; explanation: string }[];
    step: string;
    question: string;
    pageId: string;
  };

  if (!image || !pageId || !step || !question || !previousSteps) {
    return NextResponse.json({ error: "Alle Felder sind erforderlich." }, { status: 400 });
  }

  const access = await canAccessPage(session.user.id, pageId);
  if (!access) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  try {
    const provider = getAiProvider();
    const imageBuffer = Buffer.from(image, "base64");
    const systemPrompt = buildExplainPrompt(previousSteps, step, question);
    const context: AiExplainContext = { previousSteps, step, question };
    const result = await provider.explain(imageBuffer, context, systemPrompt);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI explain error:", error);
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht verarbeitet werden." },
      { status: 502 },
    );
  }
}
