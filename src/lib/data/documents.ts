import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/documents";

const COLUMNS = "id, client_id, label, title, mime_type, size_bytes, created_at";

export async function listClientDocuments(clientId: string): Promise<DocumentRow[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export type RecentDocument = DocumentRow & { client: { full_name: string } | null };

export async function listRecentDocuments(limit = 30): Promise<RecentDocument[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(`${COLUMNS}, client:clients(full_name)`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as RecentDocument[];
}
