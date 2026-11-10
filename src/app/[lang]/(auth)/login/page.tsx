import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{dict.auth.signInTitle}</h1>
        <p className="text-caption text-muted">{dict.auth.signInIntro}</p>
      </div>
      {/* The form reads ?reason=idle, which is only known at request time. */}
      <Suspense>
        <LoginForm lang={lang} t={dict.auth} />
      </Suspense>
    </>
  );
}
