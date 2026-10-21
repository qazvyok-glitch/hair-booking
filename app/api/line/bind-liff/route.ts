import { NextRequest, NextResponse } from "next/server";
import { maskLineId } from "../../../../lib/lineBinding";
import { createRequestSupabase } from "../../../../lib/supabase";

type LineProfile = {
  userId?: string;
  displayName?: string;
};

async function getLineProfile(accessToken: string) {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("LINE_LIFF_PROFILE_FAILED", {
      status: response.status,
      detail: detail.slice(0, 180),
    });
    return null;
  }

  return response.json() as Promise<LineProfile>;
}

export async function POST(request: NextRequest) {
  let body: {
    accessToken?: string;
    bookingId?: number;
    bookingToken?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const accessToken = (body.accessToken || "").trim();
  const bookingId = Number(body.bookingId || 0);
  const bookingToken = (body.bookingToken || "").trim();

  if (!accessToken || !bookingId || !bookingToken) {
    return NextResponse.json({ ok: false, error: "Invalid LIFF binding information" }, { status: 400 });
  }

  try {
    const profile = await getLineProfile(accessToken);
    if (!profile?.userId) {
      return NextResponse.json({ ok: false, error: "LINE profile unavailable" }, { status: 401 });
    }

    const supabase = createRequestSupabase(request.headers.get("authorization"));
    const { data, error } = await supabase.rpc("bind_booking_line_user", {
      p_booking_id: bookingId,
      p_access_token: bookingToken,
      p_official_line_user_id: profile.userId,
    });
    if (error) throw error;
    const binding = data?.[0];

    console.info("LINE_LIFF_BOUND", {
      bookingId,
      lineUserId: maskLineId(profile.userId),
    });

    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      customerId: binding?.customer_id || null,
    });
  } catch (error) {
    console.error("LINE_LIFF_BIND_FAILED", {
      message: error instanceof Error ? error.message : "Unknown LIFF binding error",
    });
    return NextResponse.json({ ok: false, error: "LINE LIFF binding failed" }, { status: 500 });
  }
}
