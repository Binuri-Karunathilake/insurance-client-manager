"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { switchLocalePath, type Locale } from "@/lib/locales";
import { Icon } from "./icons";

const IDLE_MINUTES = 30;

/**
 * Signs out after 30 minutes with no taps, clicks or typing. Supabase's own
 * inactivity timeout needs a paid plan, so the app does it itself.
 */
export function IdleSignOut({ lang }: { lang: Locale }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const signOut = async () => {
      await createClient().auth.signOut();
      router.replace(`/${lang}/login?reason=idle`);
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(signOut, IDLE_MINUTES * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    reset();
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [lang, router]);

  return null;
}

export function SignOutButton({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace(`/${lang}/login`);
        router.refresh();
      }}
      className="flex h-11 items-center gap-2 rounded-md px-3 text-body text-muted hover:bg-bg hover:text-text"
    >
      <Icon name="logout" size={20} />
      {label}
    </button>
  );
}

export function LanguageSwitch({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname();
  const other: Locale = lang === "en" ? "si" : "en";
  return (
    <Link
      href={switchLocalePath(pathname, other)}
      hrefLang={other}
      lang={other}
      className="flex h-11 items-center gap-2 rounded-md px-3 text-body text-muted hover:bg-bg hover:text-text"
    >
      <Icon name="globe" size={20} />
      {label}
    </Link>
  );
}
