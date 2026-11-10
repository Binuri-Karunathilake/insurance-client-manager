"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/locales";
import { CodeField, ErrorText, PrimaryButton } from "@/components/form";
import { SignOutButton } from "@/components/session-controls";

type T = { code: string; verify: string; verifying: string; badCode: string };

export function MfaVerify({ lang, t, signOutLabel }: { lang: Locale; t: T; signOutLabel: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    const { error } = factor
      ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      : { error: new Error("no factor") };
    if (error) {
      setError(true);
      setCode("");
      setBusy(false);
      return;
    }
    router.replace(`/${lang}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <ErrorText>{t.badCode}</ErrorText>}
      <CodeField label={t.code} value={code} onChange={setCode} />
      <PrimaryButton disabled={busy || code.length !== 6}>{busy ? t.verifying : t.verify}</PrimaryButton>
      <div className="flex justify-center">
        <SignOutButton lang={lang} label={signOutLabel} />
      </div>
    </form>
  );
}
