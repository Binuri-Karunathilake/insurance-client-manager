"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/locales";
import { CodeField, ErrorText, PrimaryButton } from "@/components/form";

type T = {
  code: string;
  verify: string;
  verifying: string;
  badCode: string;
  setupManual: string;
  setupConfirm: string;
  setupError: string;
  loading: string;
};

type Enrollment = { factorId: string; qr: string; secret: string };

export function MfaSetup({ lang, t }: { lang: Locale; t: T }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // Clear any half-finished set-up from an earlier visit first.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (cancelled) return;
      if (error || !data) setFailed(true);
      else setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(false);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
    if (error) {
      setError(true);
      setCode("");
      setBusy(false);
      return;
    }
    router.replace(`/${lang}`);
    router.refresh();
  }

  if (failed) return <ErrorText>{t.setupError}</ErrorText>;
  if (!enrollment) return <p className="text-body text-muted">{t.loading}</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Supabase returns the QR code as an SVG data URL; next/image doesn't optimise those. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrollment.qr} alt="" width={180} height={180} className="self-center rounded-md border border-border p-2" />
      <div className="flex flex-col gap-1">
        <p className="text-caption text-muted">{t.setupManual}</p>
        <code className="break-all rounded-sm bg-bg px-3 py-2 text-caption select-all">{enrollment.secret}</code>
      </div>
      <p className="text-caption text-muted">{t.setupConfirm}</p>
      {error && <ErrorText>{t.badCode}</ErrorText>}
      <CodeField label={t.code} value={code} onChange={setCode} />
      <PrimaryButton disabled={busy || code.length !== 6}>{busy ? t.verifying : t.verify}</PrimaryButton>
    </form>
  );
}
