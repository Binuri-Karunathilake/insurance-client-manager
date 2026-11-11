import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * The agency the signed-in user works in. Every insert needs it; row-level
 * security rejects any other agency, so this is a convenience, not the guard.
 */
export const getAgencyId = cache(async (): Promise<string> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("This account isn't linked to an agency.");
  return data.agency_id as string;
});
