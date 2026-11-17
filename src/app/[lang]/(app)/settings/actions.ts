"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMorningJob } from "@/lib/morning-job";
import { notificationsConfigured } from "@/lib/notify";

const isPushUrl = (v: string) => /^https:\/\/[^\s]+$/.test(v) && v.length < 1000;
const isKey = (v: string) => /^[A-Za-z0-9_-]{16,200}$/.test(v);

/** Remembers this phone or tablet so the morning job can reach it. */
export async function saveDeviceAction(device: { endpoint: string; p256dh: string; auth: string; label: string }) {
  await requireUser();
  if (!isPushUrl(device.endpoint) || !isKey(device.p256dh) || !isKey(device.auth)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth, device: device.label.slice(0, 60) },
    { onConflict: "endpoint" },
  );
  refresh();
  return { ok: !error };
}

export async function removeDeviceAction(endpoint: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  refresh();
}

export type SettingsState = { saved?: number; error?: boolean };

export async function saveSettingsAction(prev: SettingsState, form: FormData): Promise<SettingsState> {
  await requireUser();
  const language = form.get("language") === "en" ? "en" : "si";
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ email_enabled: form.get("email_enabled") === "on", language }, { onConflict: "user_id" });
  if (error) return { error: true };
  refresh();
  return { saved: (prev.saved ?? 0) + 1 };
}

export type TestResult = { status: "sent"; push: number; email: number } | { status: "nothing" } | { status: "failed" };

/** Sends today's summary to the signed-in user only, ignoring "already sent today". */
export async function sendTestAction(): Promise<TestResult> {
  const user = await requireUser();
  const configured = notificationsConfigured();
  if (!configured.push && !configured.email) return { status: "failed" };
  try {
    const report = await runMorningJob(createAdminClient(), { onlyUserId: user.id, force: true });
    if (report.pushSent + report.emailsSent === 0) {
      return report.skipped > 0 ? { status: "nothing" } : { status: "failed" };
    }
    return { status: "sent", push: report.pushSent, email: report.emailsSent };
  } catch {
    return { status: "failed" };
  }
}
