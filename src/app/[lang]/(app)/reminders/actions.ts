"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
