import type { Dictionary } from "./i18n";

/** 4500 -> "Rs. 4,500" (whole rupees; cents only when there are any) */
export function formatMoney(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `Rs. ${amount.toLocaleString("en-LK", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "2026-11-12" -> "12 Nov 2026" / "2026 නොවැ. 12" */
export function formatDate(iso: string, calendar: Dictionary["calendar"], lang: "en" | "si"): string {
  // Timestamps (created_at) are UTC: take the Sri Lanka calendar day.
  const day = iso.length > 10 ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date(iso)) : iso;
  const [y, m, d] = day.split("-").map(Number);
  const month = calendar.monthsShort[m - 1];
  return lang === "si" ? `${y} ${month} ${d}` : `${d} ${month} ${y}`;
}

/** Today's date in Sri Lanka as YYYY-MM-DD. */
export function colomboToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
}

/** Whole days from today (Sri Lanka) to the given date; negative if past. */
export function daysUntil(iso: string): number {
  const toUtc = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((toUtc(iso) - toUtc(colomboToday())) / 86_400_000);
}

/** Completed years between a birth date and today (Sri Lanka). */
export function ageFrom(dob: string): number {
  const today = colomboToday();
  let age = +today.slice(0, 4) - +dob.slice(0, 4);
  if (today.slice(5) < dob.slice(5, 10)) age -= 1;
  return age;
}
