import { NextRequest, NextResponse } from "next/server";
import { ensureLineBindingCode, getLineBindingMinutes, normalizePhone } from "../../../../lib/lineBinding";

export async function POST(request: NextRequest) {
  let body: {
    customerName?: string;
    customerPhone?: string;
    userId?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const customerName = (body.customerName || "").trim();
  const customerPhone = (body.customerPhone || "").trim();

  if (!customerName || normalizePhone(customerPhone).length < 8) {
    return NextResponse.json({ ok: false, error: "Invalid customer information" }, { status: 400 });
  }

  try {
    const binding = await ensureLineBindingCode({
      customerName,
      customerPhone,
      userId: body.userId || null,
    });

    return NextResponse.json({
      ok: true,
      alreadyBound: Boolean(binding?.alreadyBound),
      code: binding?.code || null,
      expiresAt: binding?.expiresAt || null,
      expiresInMinutes: getLineBindingMinutes(),
    });
  } catch (error) {
    console.error("LINE_BINDING_CODE_CREATE_FAILED", {
      message: error instanceof Error ? error.message : "Unknown binding code error",
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "Binding code creation failed" });
  }
}
