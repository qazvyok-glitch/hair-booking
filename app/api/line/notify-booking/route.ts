import { NextRequest, NextResponse } from "next/server";
import { pushLineText, getLineEnvTargetId, hasLineTokenConfig } from "../../../../lib/line";
import { supabase } from "../../../../lib/supabase";

type BookingRow = {
  id: number;
  designer_id: number | null;
  service_ids: number[] | null;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  status: string | null;
};

function formatDate(date: string) {
  return date ? date.replace(/-/g, "/") : "未填日期";
}

function extractServiceLine(note?: string | null) {
  const line = (note || "").split("\n").find((item) => item.startsWith("預約服務項目："));
  return line?.replace("預約服務項目：", "").trim() || "";
}

function extractCustomerNote(note?: string | null) {
  return (note || "")
    .split("\n")
    .filter((item) => item.trim() && !item.startsWith("預約服務項目："))
    .join("\n")
    .trim();
}

async function getLineBookingTargetId() {
  const envTargetId = getLineEnvTargetId();
  if (envTargetId) return envTargetId;

  const { data } = await supabase
    .from("shop_info")
    .select("value")
    .eq("key", "line_booking_notify_to")
    .eq("is_active", true)
    .maybeSingle();
  return data?.value || "";
}

export async function POST(request: NextRequest) {
  let bookingId: number | null = null;

  try {
    const body = await request.json();
    bookingId = Number(body?.bookingId || 0) || null;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "Missing bookingId" }, { status: 400 });
  }

  if (!hasLineTokenConfig()) {
    console.info("LINE_BOOKING_NOTIFY_SKIPPED", { reason: "LINE token missing", bookingId });
    return NextResponse.json({ ok: true, skipped: true, reason: "LINE token missing" });
  }

  const lineTargetId = await getLineBookingTargetId();
  if (!lineTargetId) {
    console.info("LINE_BOOKING_NOTIFY_SKIPPED", { reason: "LINE target missing", bookingId });
    return NextResponse.json({ ok: true, skipped: true, reason: "LINE target missing" });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, designer_id, service_ids, booking_date, booking_time, customer_name, customer_phone, note, status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    console.error("LINE_BOOKING_NOTIFY_BOOKING_NOT_FOUND", bookingError);
    return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  }

  const row = booking as BookingRow;
  const [{ data: designer }, { data: services }] = await Promise.all([
    row.designer_id
      ? supabase.from("designers").select("name, display_name, nickname").eq("id", row.designer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.service_ids?.length
      ? supabase.from("services").select("id, name").in("id", row.service_ids)
      : Promise.resolve({ data: [] }),
  ]);

  const serviceNames = row.service_ids
    ?.map((id) => services?.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join("、");
  const serviceText = serviceNames || extractServiceLine(row.note) || "未填服務";
  const customerNote = extractCustomerNote(row.note);
  const designerName = designer?.display_name || designer?.nickname || designer?.name || "未指定設計師";

  const lines = [
    "Bing Cherry 新預約",
    "",
    `狀態：${row.status === "pending" ? "待確認" : row.status || "未設定"}`,
    `客人：${row.customer_name || "未填姓名"}`,
    `電話：${row.customer_phone || "未填電話"}`,
    `設計師：${designerName}`,
    `時間：${formatDate(row.booking_date)} ${row.booking_time || ""}`.trim(),
    `服務：${serviceText}`,
    customerNote ? `備註：${customerNote}` : "",
    "",
    "後台查看：https://hair-booking-v2-public.vercel.app/admin/bookings",
  ].filter(Boolean);

  try {
    await pushLineText(lineTargetId, lines.join("\n"));
  } catch (error) {
    console.error("LINE_BOOKING_NOTIFY_FAILED", error);
    return NextResponse.json({ ok: false, error: "LINE push failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
