"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getAgencyId } from "@/lib/data/agency";
import { createClient } from "@/lib/supabase/server";
import { hasLocale } from "@/lib/locales";
import { POLICY_FIELDS, policyFromForm, type PolicyErrorKey } from "@/lib/validation/policy";

export type PolicyFormState = {
  errors?: Partial<Record<string, PolicyErrorKey>>;
  formError?: PolicyErrorKey;
  values?: Record<string, string>;
};

function typedValues(form: FormData) {
  return Object.fromEntries(POLICY_FIELDS.map((f) => [f, String(form.get(f) ?? "")]));
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<string, PolicyErrorKey>> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? "form")] ??= issue.message as PolicyErrorKey;
  return errors;
}

async function save(form: FormData, policyId: string | null): Promise<PolicyFormState> {
  await requireUser();
  const lang = String(form.get("lang"));
  if (!hasLocale(lang)) return { formError: "generic" };

  const parsed = policyFromForm(form);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values: typedValues(form) };

  const supabase = await createClient();
  const { client_id, ...fields } = parsed.data;
  const result = policyId
    ? await supabase.from("policies").update(fields, { count: "exact" }).eq("id", policyId).eq("client_id", client_id)
    : await supabase.from("policies").insert({ ...parsed.data, agency_id: await getAgencyId() });

  if (result.error) {
    if (result.error.code === "23505") return { errors: { policy_number: "numberTaken" }, values: typedValues(form) };
    return { formError: "generic", values: typedValues(form) };
  }
  if (policyId && !result.count) return { formError: "generic", values: typedValues(form) };
  redirect(`/${lang}/clients/${client_id}`);
}

export async function createPolicyAction(_prev: PolicyFormState, form: FormData) {
  return save(form, null);
}

export async function updatePolicyAction(_prev: PolicyFormState, form: FormData) {
  const id = String(form.get("policy_id"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { formError: "generic" as const };
  return save(form, id);
}

/** Adds an insurance company to the agency's list and returns it for the picker. */
export async function addInsurerAction(name: string): Promise<{ id: string; name: string } | { error: "insurerName" | "generic" }> {
  await requireUser();
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 80) return { error: "insurerName" };

  const supabase = await createClient();
  const agency_id = await getAgencyId();
  const { data, error } = await supabase.from("insurers").insert({ agency_id, name: clean }).select("id, name").single();
  if (error?.code === "23505") {
    // Already on the list (perhaps typed in another tab): use that one.
    const { data: existing } = await supabase.from("insurers").select("id, name").eq("name", clean).maybeSingle();
    if (existing) return existing as { id: string; name: string };
  }
  if (error || !data) return { error: "generic" };
  refresh();
  return data as { id: string; name: string };
}
