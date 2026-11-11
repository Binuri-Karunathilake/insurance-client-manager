import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getLocale } from "./i18n";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Data access layer: the one place the signed-in user comes from. Only a
 * verified session that has passed two-step sign-in (aal2) counts, so client
 * data is never served to a half-signed-in visitor, even if the proxy were
 * skipped. Cached for the length of one request.
 */
const verifySession = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || claims.aal !== "aal2") return null;

  const meta = (claims.user_metadata ?? {}) as { full_name?: string };
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    name: meta.full_name ?? null,
  };
});

/** For pages and layouts: sends signed-out visitors to the sign-in page. Call inside <Suspense>. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await verifySession();
  if (!user) redirect(`/${await getLocale()}/login`);
  return user;
}

/** For server actions, which can be called directly with a POST: refuses without a session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await verifySession();
  if (!user) throw new Error("Not signed in");
  return user;
}
