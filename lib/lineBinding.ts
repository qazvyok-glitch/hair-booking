const bindingCodeMinutes = 30;

export function normalizePhone(phone?: string | null) {
  return (phone || "").replace(/\D/g, "");
}

export function isLineBindingCode(text?: string | null) {
  return /^(?:BC-[A-F0-9]{24}|BC-(?:RESERVATION-)?\d{6})$/i.test((text || "").trim());
}

export function normalizeLineBindingCode(text?: string | null) {
  return (text || "").trim().toUpperCase();
}

export function getLineBindingMinutes() {
  return bindingCodeMinutes;
}

export function maskLineId(value?: string | null) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
