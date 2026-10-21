import { NextRequest, NextResponse } from "next/server";
import { getLineBindingMinutes } from "../../../../lib/lineBinding";
import { createRequestSupabase } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  let body: {
    bookingId?: number;
    bookingToken?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const bookingId = Number(body.bookingId || 0);
  const bookingToken = (body.bookingToken || "").trim();

  if (!bookingId || !bookingToken) {
    return NextResponse.json({ ok: false, error: "Invalid booking access" }, { status: 400 });
  }

  try {
    const supabase = createRequestSupabase(request.headers.get("authorization"));
    const { data, error } = await supabase.rpc("issue_booking_line_binding", {
      p_booking_id: bookingId,
      p_access_token: bookingToken,
    });
    if (error) throw error;
    const binding = data?.[0];

    return NextResponse.json({
      ok: true,
      alreadyBound: Boolean(binding?.already_bound),
      code: binding?.binding_code || null,
      expiresAt: binding?.expires_at || null,
      expiresInMinutes: getLineBindingMinutes(),
    });
  } catch (error) {
    console.error("LINE_BINDING_CODE_CREATE_FAILED", {
      message: error instanceof Error ? error.message : "Unknown binding code error",
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "Binding code creation failed" });
  }
}
