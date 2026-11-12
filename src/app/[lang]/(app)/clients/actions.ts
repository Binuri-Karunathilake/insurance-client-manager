"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getAgencyId } from "@/lib/data/agency";
import { createClient } from "@/lib/supabase/server";
import { hasLocale } from "@/lib/locales";
import { clientFromForm, type ClientErrorKey } from "@/lib/validation/client";

export type ClientFormState = {
  errors?: Partial<Record<string, ClientErrorKey>>;
  formError?: ClientErrorKey;
  /** What was typed, so a failed save doesn't wipe the form. */
  values?: Record<string, string>;
  /** Set after "Save and add next": the form clears and shows this name. */
  saved?: { id: string; name: string; count: number };
};

function typedValues(form: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return values;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<string, ClientErrorKey>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message as ClientErrorKey;
  }
  return errors;
}

export async function createClientAction(prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  await requireUser();
  const lang = String(form.get("lang"));
  if (!hasLocale(lang)) return { formError: "generic" };

  const parsed = clientFromForm(form);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values: typedValues(form) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, agency_id: await getAgencyId() })
    .select("id, full_name")
    .single();

  if (error) {
    if (error.code === "23505") return { errors: { nic: "nicTaken" }, values: typedValues(form) };
    return { formError: "generic", values: typedValues(form) };
  }

  if (form.get("intent") === "next") {
    refresh();
    return { saved: { id: data.id, name: data.full_name, count: (prev.saved?.count ?? 0) + 1 } };
  }
  redirect(`/${lang}/clients/${data.id}`);
}

export async function updateClientAction(prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  await requireUser();
  const lang = String(form.get("lang"));
  const id = String(form.get("id"));
  if (!hasLocale(lang) || !/^[0-9a-f-]{36}$/i.test(id)) return { formError: "generic" };

  const parsed = clientFromForm(form);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values: typedValues(form) };

  const supabase = await createClient();
  // Row-level security limits this to the user's own agency.
  const { error, count } = await supabase.from("clients").update(parsed.data, { count: "exact" }).eq("id", id);

  if (error) {
    if (error.code === "23505") return { errors: { nic: "nicTaken" }, values: typedValues(form) };
    return { formError: "generic", values: typedValues(form) };
  }
  if (!count) return { formError: "generic" };
  redirect(`/${lang}/clients/${id}`);
}
