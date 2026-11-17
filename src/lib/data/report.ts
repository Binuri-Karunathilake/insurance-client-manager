import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthRange, shiftMonth, sumMoney, type ReportPayment } from "@/lib/report";
import type { PolicyType } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type UnpaidPolicy = {
  id: string;
  premium: number;
  next_due_date: string;
  type: PolicyType;
  policy_number: string;
  client: { id: string; full_name: string } | null;
  insurer: { name: string } | null;
};

/** Supabase returns at most 1,000 rows per request: page through the rest. */
async function pages<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

function paymentsIn(supabase: Supabase, month: string, select: string) {
  const { first, last } = monthRange(month);
  return (from: number, to: number) =>
    supabase.from("payments").select(select).gte("paid_on", first).lte("paid_on", last)
      .order("paid_on", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to);
}

export async function getMonthlyReport(month: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { last } = monthRange(month);

  const [payments, previous, unpaid] = await Promise.all([
    pages<ReportPayment>(
      paymentsIn(supabase, month,
        "id, amount, paid_on, due_date, method, client:clients(id, full_name), policy:policies(type, policy_number, insurer:insurers(name))"),
    ),
    pages<{ amount: number }>(paymentsIn(supabase, shiftMonth(month, -1), "amount")),
    // Premiums due by the end of the month that are still waiting to be marked paid.
    pages<UnpaidPolicy>((from, to) =>
      supabase.from("policies")
        .select("id, premium, next_due_date, type, policy_number, client:clients(id, full_name), insurer:insurers(name)")
        .eq("status", "active").lte("next_due_date", last)
        .order("next_due_date").order("id").range(from, to),
    ),
  ]);

  return {
    payments,
    previousTotal: sumMoney(previous.map((p) => p.amount)),
    unpaid,
    unpaidTotal: sumMoney(unpaid.map((p) => p.premium)),
  };
}

/** This month's total, for the Today screen. */
export async function getMonthTotal(month: string): Promise<{ total: number; count: number }> {
  await getCurrentUser();
  const supabase = await createClient();
  const rows = await pages<{ amount: number }>(paymentsIn(supabase, month, "amount"));
  return { total: sumMoney(rows.map((r) => r.amount)), count: rows.length };
}
