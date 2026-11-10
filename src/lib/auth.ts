import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getLocale } from "./i18n";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Data access layer: the one place pages get the signed-in user from.
 * Requires a verified session that has passed two-step sign-in (aal2), so a
 * page can never render client data for a half-signed-in visitor even if the
 * proxy were skipped. Call it inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const lang = await getLocale();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`/${lang}/login`);
  if (claims.aal !== "aal2") redirect(`/${lang}/mfa`);

  const meta = (claims.user_metadata ?? {}) as { full_name?: string };
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    name: meta.full_name ?? null,
  };
}
