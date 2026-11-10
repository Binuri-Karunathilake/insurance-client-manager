import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import { MfaVerify } from "./mfa-verify";

export const metadata: Metadata = { title: "Enter your code" };

export default async function MfaPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{dict.auth.mfaTitle}</h1>
        <p className="text-caption text-muted">{dict.auth.mfaIntro}</p>
      </div>
      <MfaVerify lang={lang} t={dict.auth} signOutLabel={dict.app.signOut} />
    </>
  );
}
