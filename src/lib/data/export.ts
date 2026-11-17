import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentLabel } from "@/lib/documents";
import type { PaymentFrequency, PaymentMethod, PolicyStatus, PolicyType } from "@/lib/types";

// Everything the agent owns, read with their own session, so row-level
// security limits it to their agency.

export type ExportData = {
  clients: { id: string; full_name: string; mobile: string; whatsapp: string | null; nic: string | null; date_of_birth: string | null; address: string | null; preferred_language: "si" | "en"; created_at: string }[];
  policies: { client_id: string; insurer: { name: string } | null; type: PolicyType; policy_number: string; sum_assured: number | null; premium: number; frequency: PaymentFrequency; start_date: string; next_due_date: string | null; renewal_date: string | null; status: PolicyStatus }[];
  payments: { client_id: string; policy: { policy_number: string; type: PolicyType; insurer: { name: string } | null } | null; amount: number; due_date: string; paid_on: string; method: PaymentMethod }[];
  family: { client_id: string; full_name: string; relationship: string; date_of_birth: string | null }[];
  followUps: { client_id: string; due_date: string; note: string; done_at: string | null }[];
  notes: { client_id: string; body: string; created_at: string }[];
  documents: { client_id: string; title: string; label: DocumentLabel; mime_type: string; size_bytes: number; created_at: string }[];
  insurers: { name: string; branch: string | null; phone: string | null }[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Supabase returns at most 1,000 rows per request: page through the rest. */
async function all<T>(supabase: Supabase, table: string, select: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order(order).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadExportData(): Promise<ExportData> {
  await requireUser();
  const supabase = await createClient();
  const [clients, policies, payments, family, followUps, notes, documents, insurers] = await Promise.all([
    all<ExportData["clients"][number]>(supabase, "clients", "id, full_name, mobile, whatsapp, nic, date_of_birth, address, preferred_language, created_at", "full_name"),
    all<ExportData["policies"][number]>(supabase, "policies", "client_id, insurer:insurers(name), type, policy_number, sum_assured, premium, frequency, start_date, next_due_date, renewal_date, status", "policy_number"),
    all<ExportData["payments"][number]>(supabase, "payments", "client_id, policy:policies(policy_number, type, insurer:insurers(name)), amount, due_date, paid_on, method", "paid_on"),
    all<ExportData["family"][number]>(supabase, "family_members", "client_id, full_name, relationship, date_of_birth", "client_id"),
    all<ExportData["followUps"][number]>(supabase, "follow_ups", "client_id, due_date, note, done_at", "due_date"),
    all<ExportData["notes"][number]>(supabase, "client_notes", "client_id, body, created_at", "created_at"),
    all<ExportData["documents"][number]>(supabase, "documents", "client_id, title, label, mime_type, size_bytes, created_at", "created_at"),
    all<ExportData["insurers"][number]>(supabase, "insurers", "name, branch, phone", "name"),
  ]);
  return { clients, policies, payments, family, followUps, notes, documents, insurers };
}
