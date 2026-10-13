import { NextRequest, NextResponse } from "next/server";
import { bindOfficialLineUserToPhone, maskLineId, normalizePhone } from "../../../../lib/lineBinding";

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
    customerName?: string;
    customerPhone?: string;
    userId?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const accessToken = (body.accessToken || "").trim();
  const customerName = (body.customerName || "").trim();
  const customerPhone = (body.customerPhone || "").trim();

  if (!accessToken || !customerName || normalizePhone(customerPhone).length < 8) {
    return NextResponse.json({ ok: false, error: "Invalid LIFF binding information" }, { status: 400 });
  }

  try {
    const profile = await getLineProfile(accessToken);
    if (!profile?.userId) {
      return NextResponse.json({ ok: false, error: "LINE profile unavailable" }, { status: 401 });
    }

    const binding = await bindOfficialLineUserToPhone({
      customerName,
      customerPhone,
      officialLineUserId: profile.userId,
      userId: body.userId || null,
    });

    console.info("LINE_LIFF_BOUND", {
      phone: normalizePhone(customerPhone).slice(-4),
      lineUserId: maskLineId(profile.userId),
    });

    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      customerId: binding?.customerId || null,
    });
  } catch (error) {
    console.error("LINE_LIFF_BIND_FAILED", {
      message: error instanceof Error ? error.message : "Unknown LIFF binding error",
    });
    return NextResponse.json({ ok: false, error: "LINE LIFF binding failed" }, { status: 500 });
  }
}
