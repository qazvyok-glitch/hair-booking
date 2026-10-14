import { supabase } from "./supabase";

const bindingCodePrefix = "BC-Reservation";
const bindingCodeMinutes = 30;

export function normalizePhone(phone?: string | null) {
  return (phone || "").replace(/\D/g, "");
}

export function createLineBindingCode() {
  const code = Math.floor(100000 + Math.random() * 900000);
  return `${bindingCodePrefix}-${code}`;
}

export function isLineBindingCode(text?: string | null) {
  return /^BC-(?:RESERVATION-)?\d{6}$/i.test((text || "").trim());
}

export function normalizeLineBindingCode(text?: string | null) {
  return (text || "").trim().toUpperCase();
}

export function getLineBindingExpiry() {
  return new Date(Date.now() + bindingCodeMinutes * 60 * 1000).toISOString();
}

export function getLineBindingMinutes() {
  return bindingCodeMinutes;
}

export function maskLineId(value?: string | null) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function ensureLineBindingCode(params: {
  customerName: string;
  customerPhone: string;
  userId?: string | null;
}) {
  const phone = params.customerPhone.trim();
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("id, official_line_user_id")
    .eq("is_active", true)
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1);

  const existingCustomer = existingCustomers?.[0];
  if (existingCustomer?.official_line_user_id) {
    return { alreadyBound: true as const, code: null, expiresAt: null };
  }

  const code = createLineBindingCode();
  const expiresAt = getLineBindingExpiry();
  const payload = {
    name: params.customerName,
    phone,
    line_binding_code: code,
    line_binding_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (existingCustomer?.id) {
    const { error } = await supabase.from("customers").update(payload).eq("id", existingCustomer.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("customers").insert({
      id: params.userId || crypto.randomUUID(),
      ...payload,
    });
    if (error) throw error;
  }

  return { alreadyBound: false as const, code, expiresAt };
}

export async function bindOfficialLineUserToPhone(params: {
  customerName: string;
  customerPhone: string;
  officialLineUserId: string;
  userId?: string | null;
}) {
  const phone = params.customerPhone.trim();
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !params.officialLineUserId) return null;

  const now = new Date().toISOString();
  const payload = {
    name: params.customerName,
    phone,
    official_line_user_id: params.officialLineUserId,
    line_bound_at: now,
    line_binding_code: null,
    line_binding_expires_at: null,
    updated_at: now,
  };

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("id, official_line_user_id")
    .eq("is_active", true)
    .eq("phone", phone)
    .order("official_line_user_id", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  const existingCustomer = existingCustomers?.[0];
  if (existingCustomer?.id) {
    const { error } = await supabase.from("customers").update(payload).eq("id", existingCustomer.id);
    if (error) throw error;
    return { customerId: existingCustomer.id, alreadyBound: Boolean(existingCustomer.official_line_user_id) };
  }

  const customerId = params.userId || crypto.randomUUID();
  const { error } = await supabase.from("customers").insert({
    id: customerId,
    ...payload,
  });
  if (error) throw error;
  return { customerId, alreadyBound: false };
}
