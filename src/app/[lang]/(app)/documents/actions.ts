"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getAgencyId } from "@/lib/data/agency";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_TYPES, DOCUMENT_LABELS, MAX_BYTES, type DocumentLabel } from "@/lib/documents";

// Upload in three steps, so the browser sends the file straight to private
// storage but the server decides where it goes and what gets recorded:
// 1. prepareUploadAction: checks the client and file, picks the path, and
//    returns a one-time upload token for exactly that path.
// 2. The browser uploads the file with the token.
// 3. finalizeUploadAction: checks the file arrived, then saves the record.

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export type PrepareResult = { ok: true; path: string; token: string } | { ok: false; error: "type" | "size" | "client" | "generic" };

export async function prepareUploadAction(input: { clientId: string; mime: string; size: number }): Promise<PrepareResult> {
  await requireUser();
  const ext = ALLOWED_TYPES[input.mime];
  if (!ext) return { ok: false, error: "type" };
  if (!(input.size > 0 && input.size <= MAX_BYTES)) return { ok: false, error: "size" };
  if (!isUuid(input.clientId)) return { ok: false, error: "client" };

  const supabase = await createClient();
  // Row-level security: only finds the client if it's in this user's agency.
  const { data: client } = await supabase.from("clients").select("id").eq("id", input.clientId).maybeSingle();
  if (!client) return { ok: false, error: "client" };

  const path = `${await getAgencyId()}/${input.clientId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "generic" };
  return { ok: true, path, token: data.token };
}

export async function finalizeUploadAction(input: {
  clientId: string;
  path: string;
  label: string;
  title: string;
  mime: string;
  size: number;
}): Promise<{ ok: boolean }> {
  await requireUser();
  const agencyId = await getAgencyId();
  const label = (DOCUMENT_LABELS as readonly string[]).includes(input.label) ? (input.label as DocumentLabel) : "other";
  const title = input.title.trim().slice(0, 80);
  const expectedPrefix = `${agencyId}/${input.clientId}/`;
  const fileName = input.path.slice(expectedPrefix.length);
  if (!isUuid(input.clientId) || !input.path.startsWith(expectedPrefix) || !/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(fileName)) {
    return { ok: false };
  }
  if (!ALLOWED_TYPES[input.mime] || !title) return { ok: false };

  const supabase = await createClient();
  const { data: info, error: infoError } = await supabase.storage.from("documents").info(input.path);
  if (infoError || !info) return { ok: false };

  const { error } = await supabase.from("documents").insert({
    agency_id: agencyId,
    client_id: input.clientId,
    label,
    title,
    storage_path: input.path,
    mime_type: input.mime,
    size_bytes: Math.min(Math.max(Number(info.size) || input.size, 1), MAX_BYTES),
  });
  if (error) {
    await supabase.storage.from("documents").remove([input.path]);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

export async function deleteDocumentAction(form: FormData) {
  await requireUser();
  const id = String(form.get("document_id"));
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("id, storage_path").eq("id", id).maybeSingle();
  if (!doc) return;
  await supabase.storage.from("documents").remove([doc.storage_path as string]);
  await supabase.from("documents").delete().eq("id", id);
  refresh();
}
