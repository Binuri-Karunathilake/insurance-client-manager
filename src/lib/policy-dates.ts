// Date rules for policies. Pure functions on "YYYY-MM-DD" strings, so they
// run the same in the browser (live preview) and on the server (saving).

import type { PaymentFrequency, PolicyType } from "./types";

export const MONTHS_PER_PAYMENT: Record<Exclude<PaymentFrequency, "single">, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

/** Policy types that renew every year (life policies run for a term instead). */
export const RENEWS_YEARLY: readonly PolicyType[] = ["motor", "health", "property"];

/** Add months, keeping the day where possible: 31 Jan + 1 month -> 28/29 Feb. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * First payment date on or after `from`, counting from the start date in
 * steps of the payment period. A single premium has no next due date.
 */
export function nextDueDate(start: string, frequency: PaymentFrequency, from: string): string | null {
  if (frequency === "single") return null;
  const step = MONTHS_PER_PAYMENT[frequency];
  if (start >= from) return start;
  // Jump close, then walk; addMonths from the start date avoids day drift.
  const [sy, sm] = start.split("-").map(Number);
  const [fy, fm] = from.split("-").map(Number);
  let n = Math.max(0, Math.floor(((fy - sy) * 12 + (fm - sm)) / step) - 1);
  let due = addMonths(start, n * step);
  while (due < from) due = addMonths(start, ++n * step);
  return due;
}

/** Next anniversary of the start date on or after `from` (yearly renewals). */
export function nextRenewalDate(start: string, from: string): string {
  return nextDueDate(start, "yearly", from) as string;
}

/** The next `count` payment dates from a given due date, for the schedule preview. */
export function paymentSchedule(firstDue: string, start: string, frequency: PaymentFrequency, count = 4): string[] {
  if (frequency === "single") return [firstDue];
  const dates = [firstDue];
  while (dates.length < count) dates.push(nextDueDate(start, frequency, addOneDay(dates[dates.length - 1])) as string);
  return dates;
}

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
