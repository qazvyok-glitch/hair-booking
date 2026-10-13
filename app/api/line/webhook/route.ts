import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getLineMessagingChannelSecret, replyLineText } from "../../../../lib/line";
import { isLineBindingCode, maskLineId, normalizeLineBindingCode } from "../../../../lib/lineBinding";
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
  const secret = getLineMessagingChannelSecret();
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

async function bindCustomerLineUser(codeText: string, officialLineUserId: string) {
  const code = normalizeLineBindingCode(codeText);
  const now = new Date().toISOString();
  const { data: customers, error: lookupError } = await supabase
    .from("customers")
    .select("id, name, phone, line_binding_expires_at")
    .eq("line_binding_code", code)
    .gt("line_binding_expires_at", now)
    .limit(1);

  if (lookupError) throw lookupError;
  const customer = customers?.[0];
  if (!customer?.id) return null;

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      official_line_user_id: officialLineUserId,
      line_bound_at: now,
      line_binding_code: null,
      line_binding_expires_at: null,
      updated_at: now,
    })
    .eq("id", customer.id);

  if (updateError) throw updateError;
  return customer;
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
      const messageText = event.message?.text || "";

      console.info("LINE_WEBHOOK_EVENT", {
        eventType: event.type || "",
        sourceType: source.type || "",
        targetId: maskLineId(lineTargetId),
        messageType: event.message?.type || "",
        text: isLineBindingCode(messageText) ? normalizeLineBindingCode(messageText) : "",
      });

      if (event.message?.type === "text" && isLineBindingCode(messageText)) {
        if (!source.userId) {
          await safeReply(event.replyToken, "綁定失敗：請使用個人 LINE 帳號傳送綁定碼。");
          continue;
        }

        try {
          const customer = await bindCustomerLineUser(messageText, source.userId);
          if (!customer) {
            await safeReply(event.replyToken, "綁定碼無效或已過期，請重新送出預約取得新的綁定碼。");
            continue;
          }

          await safeReply(event.replyToken, "已完成 Bing Cherry Salon LINE 預約通知綁定。之後預約狀態會傳送到這裡。");
          console.info("LINE_CUSTOMER_BIND_SUCCEEDED", {
            customerId: customer.id,
            lineUserId: maskLineId(source.userId),
          });
        } catch (error) {
          console.error("LINE_CUSTOMER_BIND_FAILED", {
            message: error instanceof Error ? error.message : "Unknown LINE binding error",
          });
          await safeReply(event.replyToken, "綁定失敗，請稍後再試。");
        }
        continue;
      }

      if (event.message?.type === "text" && shouldBindBookingNotification(messageText)) {
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
