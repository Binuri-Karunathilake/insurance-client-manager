import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientNote, ClientStatus, DueItem, FamilyMember, Insurer, Policy } from "@/lib/types";

export const CLIENT_FILTERS = ["all", "due", "overdue", "birthday", "lapsed"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export const PAGE_SIZE = 50;

export type ClientListRow = Pick<Client, "id" | "full_name" | "mobile"> & {
  policies: Pick<Policy, "type" | "status">[];
  status: ClientStatus | null;
};

// PostgREST filter strings treat , ( ) as syntax; keep search text plain.
function cleanSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
}

/** One status per client, most urgent first. */
function statusesFrom(due: DueItem[], lapsedIds: Set<string>) {
  const rank: Record<ClientStatus, number> = { overdue: 4, due: 3, birthday: 2, lapsed: 1 };
  const map = new Map<string, ClientStatus>();
  const bump = (id: string, s: ClientStatus) => {
    const current = map.get(id);
    if (!current || rank[s] > rank[current]) map.set(id, s);
  };
  for (const d of due) {
    if (d.days_left < 0) bump(d.client_id, "overdue");
    else if (d.kind === "premium" || (d.kind === "renewal" && d.days_left <= 30)) bump(d.client_id, "due");
    else if (d.kind === "birthday" && !d.family_member_id) bump(d.client_id, "birthday");
  }
  for (const id of lapsedIds) bump(id, "lapsed");
  return map;
}

/** Clients whose policies are all lapsed (has at least one, none active or pending). */
async function lapsedClientIds(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("policies").select("client_id, status");
  const byClient = new Map<string, string[]>();
  for (const p of (data ?? []) as Pick<Policy, "client_id" | "status">[]) {
    byClient.set(p.client_id, [...(byClient.get(p.client_id) ?? []), p.status]);
  }
  const ids = new Set<string>();
  for (const [id, statuses] of byClient) {
    if (statuses.includes("lapsed") && !statuses.some((s) => s === "active" || s === "pending")) ids.add(id);
  }
  return ids;
}

export async function listClients({ q = "", filter = "all", limit = PAGE_SIZE }: { q?: string; filter?: ClientFilter; limit?: number }) {
  await getCurrentUser();
  const supabase = await createClient();

  const [{ data: dueData }, lapsed] = await Promise.all([
    supabase.from("due_items").select("kind, client_id, family_member_id, days_left"),
    lapsedClientIds(supabase),
  ]);
  const statuses = statusesFrom((dueData ?? []) as DueItem[], lapsed);

  let query = supabase
    .from("clients")
    .select("id, full_name, mobile, policies(type, status)", { count: "exact" })
    .order("full_name")
    .limit(limit);

  if (filter !== "all") {
    const ids = [...statuses].filter(([, s]) => s === filter).map(([id]) => id);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const term = cleanSearch(q);
  if (term) {
    const digits = term.replace(/\D/g, "");
    const { data: byPolicy } = await supabase
      .from("policies")
      .select("client_id")
      .ilike("policy_number", `%${term}%`)
      .limit(50);
    const policyClientIds = [...new Set((byPolicy ?? []).map((p) => p.client_id as string))];
    const or = [`full_name.ilike.%${term}%`, `nic.ilike.%${term}%`];
    if (digits.length >= 3) or.push(`mobile_digits.like.%${digits.replace(/^94/, "0")}%`);
    if (policyClientIds.length) or.push(`id.in.(${policyClientIds.join(",")})`);
    query = query.or(or.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as Omit<ClientListRow, "status">[]).map((c) => ({ ...c, status: statuses.get(c.id) ?? null }));
  return { rows, total: count ?? rows.length };
}

export type ClientProfile = Client & {
  policies: (Policy & { insurer: Pick<Insurer, "name"> | null })[];
  family_members: FamilyMember[];
  client_notes: ClientNote[];
  documents: { count: number }[];
};

export async function getClientProfile(id: string): Promise<{ client: ClientProfile; due: DueItem[] } | null> {
  await getCurrentUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();

  const [{ data, error }, { data: due }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, full_name, mobile, whatsapp, nic, date_of_birth, address, preferred_language, created_at," +
          " policies(*, insurer:insurers(name)), family_members(*), client_notes(id, client_id, body, created_at), documents(count)",
      )
      .eq("id", id)
      .order("start_date", { referencedTable: "policies", ascending: false })
      .order("created_at", { referencedTable: "client_notes", ascending: false })
      .order("full_name", { referencedTable: "family_members" })
      .maybeSingle(),
    supabase.from("due_items").select("*").eq("client_id", id),
  ]);

  if (error) throw error;
  if (!data) return null;
  return { client: data as unknown as ClientProfile, due: (due ?? []) as DueItem[] };
}

export async function listInsurers(): Promise<Insurer[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("insurers").select("id, name, branch").order("name");
  return (data ?? []) as Insurer[];
}

/** Clients created since midnight Sri Lanka time, newest first (for bulk entry). */
export async function listAddedToday(): Promise<Pick<Client, "id" | "full_name" | "mobile">[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, mobile")
    .gte("created_at", `${today}T00:00:00+05:30`)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Pick<Client, "id" | "full_name" | "mobile">[];
}

/** Every client's name and phone, for pickers. */
export async function listClientOptions(): Promise<Pick<Client, "id" | "full_name" | "mobile">[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, full_name, mobile").order("full_name").limit(2000);
  return (data ?? []) as Pick<Client, "id" | "full_name" | "mobile">[];
}
