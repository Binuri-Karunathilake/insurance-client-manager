import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDigest, type DigestItem } from "./digest";
import { colomboToday } from "./format";
import { appUrl, notificationsConfigured, sendEmail, sendPush } from "./notify";
import type { DueItem, PolicyType } from "./types";

type Settings = { push_enabled: boolean; email_enabled: boolean; language: "si" | "en"; last_sent_on: string | null };
const DEFAULTS: Settings = { push_enabled: true, email_enabled: true, language: "si", last_sent_on: null };

export type JobReport = {
  date: string;
  users: number;
  skipped: number;
  pushSent: number;
  pushRemoved: number;
  pushFailed: number;
  emailsSent: number;
  emailsFailed: number;
};

/** One agency's due items in the shape the summary needs. Uses the admin client: scope by agency. */
export async function loadDigestItems(db: SupabaseClient, agencyId: string): Promise<DigestItem[]> {
  const { data: due, error } = await db.from("due_items").select("*").eq("agency_id", agencyId).order("due_on");
  if (error) throw error;
  const items = (due ?? []) as (DueItem & { agency_id: string })[];
  if (items.length === 0) return [];

  const ids = (pick: (d: DueItem) => string | null) => [...new Set(items.map(pick).filter((v): v is string => !!v))];
  const [clients, policies, family] = await Promise.all([
    db.from("clients").select("id, full_name").eq("agency_id", agencyId).in("id", ids((d) => d.client_id)),
    db.from("policies").select("id, type, premium").eq("agency_id", agencyId).in("id", ids((d) => d.policy_id)),
    db.from("family_members").select("id, full_name").eq("agency_id", agencyId).in("id", ids((d) => d.family_member_id)),
  ]);
  const map = <T extends { id: string }>(rows: T[] | null) => new Map((rows ?? []).map((r) => [r.id, r]));
  const c = map(clients.data as { id: string; full_name: string }[] | null);
  const p = map(policies.data as { id: string; type: PolicyType; premium: number }[] | null);
  const f = map(family.data as { id: string; full_name: string }[] | null);

  return items.flatMap((d) => {
    const client = c.get(d.client_id);
    if (!client) return [];
    const policy = d.policy_id ? p.get(d.policy_id) : undefined;
    return [
      {
        kind: d.kind,
        days_left: d.days_left,
        due_on: d.due_on,
        client_name: client.full_name,
        policy_type: policy?.type ?? null,
        premium: policy?.premium ?? null,
        member_name: d.family_member_id ? (f.get(d.family_member_id)?.full_name ?? null) : null,
        note: d.kind === "follow_up" ? d.detail : null,
      },
    ];
  });
}

/**
 * Sends each user their morning summary by push and/or email.
 * Runs once a day; a user already sent today is skipped, so a retried
 * job never sends twice. `onlyUserId` + `force` power the Send a test button.
 */
export async function runMorningJob(
  db: SupabaseClient,
  { onlyUserId, force = false }: { onlyUserId?: string; force?: boolean } = {},
): Promise<JobReport> {
  const today = colomboToday();
  const report: JobReport = { date: today, users: 0, skipped: 0, pushSent: 0, pushRemoved: 0, pushFailed: 0, emailsSent: 0, emailsFailed: 0 };
  const configured = notificationsConfigured();

  let membersQuery = db.from("agency_members").select("agency_id, user_id");
  if (onlyUserId) membersQuery = membersQuery.eq("user_id", onlyUserId);
  const { data: members, error } = await membersQuery;
  if (error) throw error;

  const itemsByAgency = new Map<string, DigestItem[]>();

  for (const { agency_id, user_id } of (members ?? []) as { agency_id: string; user_id: string }[]) {
    report.users++;
    const { data: row } = await db.from("notification_settings").select("*").eq("user_id", user_id).maybeSingle();
    const settings: Settings = { ...DEFAULTS, ...(row ?? {}) };
    if (!force && settings.last_sent_on === today) {
      report.skipped++;
      continue;
    }

    if (!itemsByAgency.has(agency_id)) itemsByAgency.set(agency_id, await loadDigestItems(db, agency_id));
    const { data: userData } = await db.auth.admin.getUserById(user_id);
    const user = userData?.user;
    const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

    const digest = buildDigest(itemsByAgency.get(agency_id)!, { lang: settings.language, today, agentName: firstName, appUrl: appUrl() });
    if (!digest) {
      report.skipped++;
      continue;
    }

    if (configured.push && settings.push_enabled) {
      const { data: devices } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user_id);
      for (const device of (devices ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
        const result = await sendPush(device, {
          title: digest.pushTitle,
          body: digest.pushBody,
          url: `/${settings.language}/reminders`,
        });
        if (result === "sent") {
          report.pushSent++;
          await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", device.id);
        } else if (result === "gone") {
          report.pushRemoved++;
          await db.from("push_subscriptions").delete().eq("id", device.id);
        } else report.pushFailed++;
      }
    }

    if (configured.email && settings.email_enabled && user?.email) {
      const ok = await sendEmail({ to: user.email, subject: digest.subject, html: digest.html, text: digest.text });
      if (ok) report.emailsSent++;
      else report.emailsFailed++;
    }

    if (!force) {
      await db.from("notification_settings").upsert({ user_id, last_sent_on: today }, { onConflict: "user_id" });
    }
  }
  return report;
}
