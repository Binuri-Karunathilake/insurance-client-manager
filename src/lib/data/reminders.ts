import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, DueItem, FamilyMember, Policy } from "@/lib/types";

export type Reminder = DueItem & {
  /** Stable key for lists: the same client can have several items on one day. */
  key: string;
  client: Pick<Client, "id" | "full_name" | "mobile" | "whatsapp" | "preferred_language">;
  family: Pick<FamilyMember, "full_name" | "relationship"> | null;
  policy: Pick<Policy, "id" | "type" | "policy_number" | "frequency" | "premium" | "next_due_date" | "renewal_date"> | null;
};

/**
 * Everything that needs attention, from the due_items view (premiums in the
 * next 7 days, renewals in the next 30, birthdays in the next 7, open
 * follow-ups, anything overdue), with the client, policy and family member
 * each item belongs to. Sorted oldest first, so overdue items lead.
 */
export async function listReminders(): Promise<Reminder[]> {
  await requireUser();
  const supabase = await createClient();

  const { data: due, error } = await supabase
    .from("due_items")
    .select("*")
    .order("due_on")
    .order("kind");
  if (error) throw error;
  const items = (due ?? []) as DueItem[];
  if (items.length === 0) return [];

  const ids = (pick: (d: DueItem) => string | null) => [...new Set(items.map(pick).filter((v): v is string => !!v))];
  const clientIds = ids((d) => d.client_id);
  const policyIds = ids((d) => d.policy_id);
  const familyIds = ids((d) => d.family_member_id);

  const [clients, policies, family] = await Promise.all([
    supabase.from("clients").select("id, full_name, mobile, whatsapp, preferred_language").in("id", clientIds),
    policyIds.length
      ? supabase.from("policies").select("id, type, policy_number, frequency, premium, next_due_date, renewal_date").in("id", policyIds)
      : Promise.resolve({ data: [] }),
    familyIds.length
      ? supabase.from("family_members").select("id, full_name, relationship").in("id", familyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const byId = <T extends { id: string }>(rows: T[] | null) => new Map((rows ?? []).map((r) => [r.id, r]));
  const clientMap = byId(clients.data as Reminder["client"][] | null);
  const policyMap = byId(policies.data as NonNullable<Reminder["policy"]>[] | null);
  const familyMap = byId(family.data as (Reminder["family"] & { id: string })[] | null);

  return items.flatMap((d) => {
    const client = clientMap.get(d.client_id);
    if (!client) return [];
    return [
      {
        ...d,
        key: [d.kind, d.client_id, d.policy_id, d.family_member_id, d.follow_up_id, d.due_on].join(":"),
        client,
        policy: d.policy_id ? (policyMap.get(d.policy_id) ?? null) : null,
        family: d.family_member_id ? (familyMap.get(d.family_member_id) ?? null) : null,
      },
    ];
  });
}
