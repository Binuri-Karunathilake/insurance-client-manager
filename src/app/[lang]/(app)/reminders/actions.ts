"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgencyId } from "@/lib/data/agency";
import { hasLocale } from "@/lib/locales";

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** A renewal is done: the renewal date moves on a year. */
export async function markRenewedAction(form: FormData) {
  await requireUser();
  const id = form.get("policy_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_policy_renewed", { target_policy: id });
  refresh();
}

/** A follow-up is done: it leaves the list but stays in the history. */
export async function completeFollowUpAction(form: FormData) {
  await requireUser();
  const id = form.get("follow_up_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("follow_ups").update({ done_at: new Date().toISOString() }).eq("id", id).is("done_at", null);
  refresh();
}

export type FollowUpState = { errors?: Partial<Record<"client_id" | "due_date" | "note" | "form", string>>; values?: Record<string, string> };

/** Adds a follow-up for a client, then goes back where the agent came from. */
export async function createFollowUpAction(_prev: FollowUpState, form: FormData): Promise<FollowUpState> {
  await requireUser();
  const values = {
    client_id: String(form.get("client_id") ?? ""),
    due_date: String(form.get("due_date") ?? ""),
    note: String(form.get("note") ?? "").trim(),
  };
  const lang = String(form.get("lang"));
  const back = String(form.get("back") ?? "");
  const errors: FollowUpState["errors"] = {};
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
  if (!isUuid(values.client_id)) errors.client_id = "clientRequired";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.due_date) || values.due_date < today) errors.due_date = "dateInvalid";
  if (!values.note || values.note.length > 300) errors.note = "noteRequired";
  if (!hasLocale(lang)) errors.form = "generic";
  if (Object.keys(errors).length) return { errors, values };

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({ ...values, agency_id: await getAgencyId() });
  if (error) return { errors: { form: "generic" }, values };

  // Only go back to a page inside the app.
  redirect(back.startsWith(`/${lang}/`) && !back.startsWith("//") ? back : `/${lang}/reminders`);
}
