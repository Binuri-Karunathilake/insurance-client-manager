// Sri Lankan phone numbers. Stored as typed for display ("077 123 4567"),
// turned into +94 format for call and WhatsApp links.

/** Digits only, in local form: "+94 77 123 4567" -> "0771234567". Null if it isn't a valid number. */
export function normalisePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (digits.length === 9 && !digits.startsWith("0")) digits = `0${digits}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/** "0771234567" -> "077 123 4567" */
export function formatPhone(input: string): string {
  const local = normalisePhone(input);
  if (!local) return input.trim();
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** "077 123 4567" -> "+94771234567" */
export function internationalPhone(input: string): string | null {
  const local = normalisePhone(input);
  return local ? `+94${local.slice(1)}` : null;
}

export function telLink(input: string): string | null {
  const intl = internationalPhone(input);
  return intl ? `tel:${intl}` : null;
}

export function whatsappLink(input: string, text?: string): string | null {
  const intl = internationalPhone(input);
  if (!intl) return null;
  const base = `https://wa.me/${intl.slice(1)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * National Identity Card: old format 9 digits + V/X (e.g. 791234567V),
 * new format 12 digits (e.g. 197912345678).
 */
export function normaliseNic(input: string): string | null {
  const nic = input.replace(/\s/g, "").toUpperCase();
  return /^\d{9}[VX]$/.test(nic) || /^\d{12}$/.test(nic) ? nic : null;
}

/** Show only the last 4 characters on screen: "••••••••123V" */
export function maskNic(nic: string): string {
  return `${"•".repeat(Math.max(nic.length - 4, 0))}${nic.slice(-4)}`;
}
