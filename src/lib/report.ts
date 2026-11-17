import type { PaymentMethod, PolicyType } from "./types";

// The monthly report's sums. Pure functions, so they're easy to check.

export type ReportPayment = {
  id: string;
  amount: number;
  paid_on: string;
  due_date: string;
  method: PaymentMethod;
  client: { id: string; full_name: string } | null;
  policy: { type: PolicyType; policy_number: string; insurer: { name: string } | null } | null;
};

export type Group<K extends string = string> = { key: K; total: number; count: number };

function groupBy<K extends string>(payments: ReportPayment[], keyOf: (p: ReportPayment) => K): Group<K>[] {
  const groups = new Map<K, Group<K>>();
  for (const p of payments) {
    const key = keyOf(p);
    const g = groups.get(key) ?? { key, total: 0, count: 0 };
    g.total += Number(p.amount);
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

/** Money is summed in cents, so 0.1 + 0.2 stays 0.30. */
function sum(amounts: number[]): number {
  return amounts.reduce((cents, a) => cents + Math.round(Number(a) * 100), 0) / 100;
}

export function summarize(payments: ReportPayment[]) {
  const roundGroups = <K extends string>(groups: Group<K>[]) =>
    groups.map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }));
  return {
    total: sum(payments.map((p) => p.amount)),
    count: payments.length,
    // "" stands for "insurer not set"; the page shows its own label.
    byInsurer: roundGroups(groupBy(payments, (p) => p.policy?.insurer?.name ?? "")),
    byType: roundGroups(groupBy(payments, (p) => p.policy?.type ?? "other")),
    byMethod: roundGroups(groupBy(payments, (p) => p.method)),
  };
}

export { sum as sumMoney };

/** "2026-11" for a YYYY-MM-DD date. */
export const monthOf = (date: string) => date.slice(0, 7);

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string): { first: string; last: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** The month before or after a YYYY-MM month. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A valid month from the URL, never after the current one; otherwise the current month. */
export function pickMonth(value: unknown, current: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return current;
  if (value > current || value < "2000-01") return current;
  return value;
}
