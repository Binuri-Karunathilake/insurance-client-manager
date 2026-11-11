"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getAgencyId } from "@/lib/data/agency";
import { createClient } from "@/lib/supabase/server";
import { RELATIONSHIPS } from "@/lib/family";

export type SmallFormState = { error?: string; values?: Record<string, string>; done?: number };

const uuid = z.string().uuid();

const familySchema = z.object({
  client_id: uuid,
  full_name: z.string().trim().min(1, "nameRequired").max(120, "nameRequired"),
  relationship: z.enum(RELATIONSHIPS),
  date_of_birth: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v > "1900-01-01" && new Date(v) <= new Date()), "dobInvalid")
    .transform((v) => v || null),
});

export async function addFamilyMember(prev: SmallFormState, form: FormData): Promise<SmallFormState> {
  await requireUser();
  const values = Object.fromEntries([...form.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
  const parsed = familySchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "generic", values };

  const supabase = await createClient();
  const { error } = await supabase.from("family_members").insert({ ...parsed.data, agency_id: await getAgencyId() });
  if (error) return { error: "generic", values };
  refresh();
  return { done: (prev.done ?? 0) + 1 };
}

const noteSchema = z.object({
  client_id: uuid,
  body: z.string().trim().min(1, "bodyRequired").max(2000, "bodyRequired"),
});

export async function addNote(prev: SmallFormState, form: FormData): Promise<SmallFormState> {
  await requireUser();
  const values = { client_id: String(form.get("client_id")), body: String(form.get("body") ?? "") };
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "generic", values };

  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({ ...parsed.data, agency_id: await getAgencyId() });
  if (error) return { error: "generic", values };
  refresh();
  return { done: (prev.done ?? 0) + 1 };
}

/** Deletes a family member or a note. Row-level security keeps it to the user's own agency. */
export async function removeItem(form: FormData) {
  await requireUser();
  const table = form.get("table");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success || (table !== "family_members" && table !== "client_notes")) return;

  const supabase = await createClient();
  await supabase.from(table).delete().eq("id", id.data);
  refresh();
}
