import { NextRequest, NextResponse } from "next/server";

type LineWebhookEvent = {
  type?: string;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    const payload = JSON.parse(rawBody || "{}");
    const events: LineWebhookEvent[] = Array.isArray(payload.events) ? payload.events : [];

    for (const event of events) {
      const source = event.source || {};
      const lineTargetId = source.groupId || source.roomId || source.userId || "";

      console.info("LINE_WEBHOOK_EVENT", {
        eventType: event.type || "",
        sourceType: source.type || "",
        targetId: lineTargetId,
        messageType: event.message?.type || "",
        text: event.message?.text || "",
      });
    }
  } catch (error) {
    console.error("LINE_WEBHOOK_PARSE_ERROR", error);
  }

  return NextResponse.json({ ok: true });
}
