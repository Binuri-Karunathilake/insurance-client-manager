import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { LOCALE_COOKIE, defaultLocale, hasLocale, type Locale } from "@/lib/locales";

/**
 * Runs before every page:
 * 1. Puts a language in the URL (/clients -> /si/clients), using the last
 *    language chosen, then the browser's language.
 * 2. Sends people to the right sign-in step: password, then authenticator
 *    code. Nothing in the app is reachable without both.
 *
 * This is the fast first check. Pages and server actions check the user
 * again close to the data, and row-level security checks it again in the
 * database.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");

  if (!hasLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const lang: Locale = first;
  const route = `/${rest.join("/")}`.replace(/\/$/, "") || "/";
  const { response, state } = await updateSession(request);

  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}${to === "/" ? "" : to}`;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // keep any refreshed session cookies
    for (const c of response().cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };

  const allowed: Record<AuthStatus, (r: string) => boolean> = {
    "signed-out": (r) => r === "/login",
    "needs-setup": (r) => r === "/mfa/setup",
    "needs-code": (r) => r === "/mfa",
    ok: (r) => r !== "/login" && !r.startsWith("/mfa"),
  };
  const home: Record<AuthStatus, string> = {
    "signed-out": "/login",
    "needs-setup": "/mfa/setup",
    "needs-code": "/mfa",
    ok: "/",
  };

  if (!allowed[state.status](route)) return go(home[state.status]);

  const res = response();
  res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

type AuthStatus = Awaited<ReturnType<typeof updateSession>>["state"]["status"];

function pickLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;
  const accept = request.headers.get("accept-language") ?? "";
  if (/\bsi\b/i.test(accept)) return "si";
  return defaultLocale;
}

export const config = {
  matcher: [
    // Everything except Next.js internals, the manifest, icons and other static files.
    "/((?!_next/static|_next/image|manifest.webmanifest|icons/|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2)$).*)",
  ],
};
