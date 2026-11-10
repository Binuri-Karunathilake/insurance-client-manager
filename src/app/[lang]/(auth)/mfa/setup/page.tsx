import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import { MfaSetup } from "./mfa-setup";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default async function MfaSetupPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{dict.auth.setupTitle}</h1>
        <p className="text-caption text-muted">{dict.auth.setupIntro}</p>
      </div>
      <MfaSetup lang={lang} t={dict.auth} />
    </>
  );
}
