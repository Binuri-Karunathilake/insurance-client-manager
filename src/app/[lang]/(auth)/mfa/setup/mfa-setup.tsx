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
  tryAgain: string;
  loading: string;
};

type Enrollment = { factorId: string; qr: string; secret: string };

/** Removes set-ups that were started but never confirmed with a code. */
async function clearUnverified(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
}

async function enroll(): Promise<Enrollment | null> {
  const supabase = createClient();
  // A fixed issuer: by default Supabase uses the site address, and one with a
  // port ("localhost:3000") makes Google Authenticator reject the QR code.
  const options = { factorType: "totp", friendlyName: "Authenticator app", issuer: "Client Manager" } as const;
  for (let attempt = 0; attempt < 2; attempt++) {
    await clearUnverified(supabase);
    const { data, error } = await supabase.auth.mfa.enroll(options);
    if (data && !error) return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
    console.error("Two-step set-up failed:", error?.message);
  }
  return null;
}

// One set-up at a time per page load. React runs effects twice in
// development, and two set-ups racing each other made Supabase refuse the
// second ("a factor with this name already exists").
let pending: Promise<Enrollment | null> | null = null;
function startEnrollment() {
  pending ??= enroll().then((result) => {
    if (!result) pending = null; // let "Try again" start fresh
    return result;
  });
  return pending;
}

export function MfaSetup({ lang, t }: { lang: Locale; t: T }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    startEnrollment().then((result) => {
      if (cancelled) return;
      if (result) setEnrollment(result);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

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
    pending = null;
    router.replace(`/${lang}`);
    router.refresh();
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorText>{t.setupError}</ErrorText>
        <button
          type="button"
          className="h-11 rounded-md border border-border bg-surface px-4 text-body font-medium"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          {t.tryAgain}
        </button>
      </div>
    );
  }
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
