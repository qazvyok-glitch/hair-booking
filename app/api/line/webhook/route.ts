import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { replyLineText } from "../../../../lib/line";
import { supabase } from "../../../../lib/supabase";

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
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

function isValidLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

function shouldBindBookingNotification(text?: string) {
  const normalized = (text || "").replace(/\s+/g, "");
  return ["綁定預約通知", "綁定LINE通知", "綁定通知"].includes(normalized);
}

async function saveBookingNotifyTarget(targetId: string, sourceType: string) {
  const payload = {
    key: "line_booking_notify_to",
    label: `LINE 預約通知對象（${sourceType || "unknown"}）`,
    value: targetId,
    sort_order: 90,
    is_active: true,
  };

  const { data: existing } = await supabase.from("shop_info").select("id").eq("key", payload.key).maybeSingle();
  if (existing?.id) {
    return supabase.from("shop_info").update(payload).eq("id", existing.id);
  }
  return supabase.from("shop_info").insert(payload);
}

async function safeReply(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  try {
    await replyLineText(replyToken, text);
  } catch (error) {
    console.error("LINE_WEBHOOK_REPLY_FAILED", error);
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!isValidLineSignature(rawBody, signature)) {
    console.warn("LINE_WEBHOOK_INVALID_SIGNATURE");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

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

      if (event.message?.type === "text" && shouldBindBookingNotification(event.message.text)) {
        if (!lineTargetId) {
          await safeReply(event.replyToken, "綁定失敗：找不到這個聊天室的 LINE ID。");
          continue;
        }

        const { error } = await saveBookingNotifyTarget(lineTargetId, source.type || "unknown");
        if (error) {
          console.error("LINE_BOOKING_NOTIFY_BIND_FAILED", error);
          await safeReply(event.replyToken, "綁定失敗，請稍後再試。");
          continue;
        }

        await safeReply(event.replyToken, "已綁定此聊天室為 Bing Cherry 預約通知對象。之後新預約會推播到這裡。");
      }
    }
  } catch (error) {
    console.error("LINE_WEBHOOK_PARSE_ERROR", error);
  }

  return NextResponse.json({ ok: true });
}
