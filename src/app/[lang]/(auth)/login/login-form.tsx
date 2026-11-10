"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/locales";
import { ErrorText, Field, PrimaryButton } from "@/components/form";

type T = { email: string; password: string; signIn: string; signingIn: string; badLogin: string; idleSignedOut: string };

export function LoginForm({ lang, t }: { lang: Locale; t: T }) {
  const router = useRouter();
  const idle = useSearchParams().get("reason") === "idle";
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    // The proxy sends the user on to the code step (or set-up on first sign-in).
    router.replace(`/${lang}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {idle && !error && <p className="rounded-sm bg-primary-soft px-3 py-2 text-caption text-primary">{t.idleSignedOut}</p>}
      {error && <ErrorText>{t.badLogin}</ErrorText>}
      <Field label={t.email} name="email" type="email" autoComplete="email" required autoFocus />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required />
      <PrimaryButton disabled={busy}>{busy ? t.signingIn : t.signIn}</PrimaryButton>
    </form>
  );
}
