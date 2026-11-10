import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export type AuthState =
  | { status: "signed-out" }
  | { status: "needs-setup" } // signed in, no authenticator app yet
  | { status: "needs-code" } // signed in, has an app, hasn't entered a code this session
  | { status: "ok" };

/**
 * Refreshes the Supabase session cookie and works out how far through
 * sign-in the visitor is. Returns the response to send on (with any
 * refreshed cookies) and the auth state.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims verifies the token; don't run other code between creating the
  // client and this call, or sessions can drop at random.
  const { data } = await supabase.auth.getClaims();

  let state: AuthState = { status: "signed-out" };
  if (data?.claims) {
    if (data.claims.aal === "aal2") {
      state = { status: "ok" };
    } else {
      // Only right after the password step: ask the auth server whether an
      // authenticator app is already set up.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasApp = factors?.totp.some((f) => f.status === "verified") ?? false;
      state = { status: hasApp ? "needs-code" : "needs-setup" };
    }
  }

  return { response: () => response, state };
}
