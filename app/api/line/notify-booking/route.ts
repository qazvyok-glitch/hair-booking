import { NextRequest, NextResponse } from "next/server";
import { hasLineTokenConfig, sendLineMessage } from "../../../../lib/line";
import { maskLineId } from "../../../../lib/lineBinding";
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
  user_id: string | null;
};

type CustomerLineTarget = {
  official_line_user_id?: string | null;
};

function formatDate(date: string) {
  return date ? date.replace(/-/g, "/") : "未填日期";
}

function extractServiceLine(note?: string | null) {
  const line = (note || "").split("\n").find((item) => item.startsWith("預約服務項目："));
  return line?.replace("預約服務項目：", "").trim() || "";
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
    console.info("LINE_BOOKING_NOTIFY_SKIPPED", { reason: "LINE Messaging config missing", bookingId });
    return NextResponse.json({ ok: true, skipped: true, reason: "LINE Messaging config missing" });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, designer_id, service_ids, booking_date, booking_time, customer_name, customer_phone, note, status, user_id")
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
  let customer: CustomerLineTarget | null = null;
  let customerError = null;

  if (row.user_id) {
    const result = await supabase
      .from("customers")
      .select("official_line_user_id")
      .eq("id", row.user_id)
      .maybeSingle();
    customer = result.data;
    customerError = result.error;
  }

  if (!customer?.official_line_user_id && row.customer_phone) {
    const result = await supabase
      .from("customers")
      .select("official_line_user_id")
      .eq("phone", row.customer_phone)
      .not("official_line_user_id", "is", null)
      .order("line_bound_at", { ascending: false, nullsFirst: false })
      .limit(1);
    customer = result.data?.[0] || customer;
    customerError = customerError || result.error;
  }

  if (customerError) {
    console.error("LINE_BOOKING_NOTIFY_CUSTOMER_LOOKUP_FAILED", { bookingId, customerError });
    return NextResponse.json({ ok: true, skipped: true, reason: "Customer lookup failed" });
  }

  const lineUserId = customer?.official_line_user_id;
  if (!lineUserId) {
    console.info("LINE_BOOKING_NOTIFY_SKIPPED", { reason: "Customer official LINE user ID missing", bookingId });
    return NextResponse.json({ ok: true, skipped: true, reason: "Customer official LINE user ID missing" });
  }

  const serviceNames = row.service_ids
    ?.map((id) => services?.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join("、");
  const serviceText = serviceNames || extractServiceLine(row.note) || "未填服務";
  const designerName = designer?.display_name || designer?.nickname || designer?.name || "未指定設計師";

  const statusIntro = row.status === "confirmed"
    ? "您好，您的 Bing Cherry Salon 預約已確認 ❤️"
    : row.status === "cancelled"
      ? "您好，您的 Bing Cherry Salon 預約目前無法成立"
      : "您好，您的 Bing Cherry Salon 預約申請已送出 ❤️";
  const lines = [
    statusIntro,
    `設計師：${designerName}`,
    `日期：${formatDate(row.booking_date)}`,
    `時間：${row.booking_time || "未填時間"}`,
    `服務項目：${serviceText}`,
    row.status === "cancelled" ? "如需重新預約，請再次進入預約系統選擇其他時間。" : "",
  ].filter(Boolean);

  try {
    await sendLineMessage(lineUserId, lines.join("\n"));
    console.info("LINE_BOOKING_NOTIFY_SENT", {
      bookingId,
      lineUserId: maskLineId(lineUserId),
      status: row.status || "",
    });
  } catch (error) {
    console.error("LINE_BOOKING_NOTIFY_FAILED", {
      bookingId,
      message: error instanceof Error ? error.message : "Unknown LINE notification error",
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "LINE push failed" });
  }

  return NextResponse.json({ ok: true });
}
