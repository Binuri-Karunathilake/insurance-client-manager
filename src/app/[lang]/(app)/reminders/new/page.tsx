import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { listClientOptions } from "@/lib/data/clients";
import { colomboToday } from "@/lib/format";
import type { Locale } from "@/lib/locales";
import { Icon } from "@/components/icons";
import { FollowUpForm } from "./follow-up-form";

export const metadata: Metadata = { title: "New follow-up" };

export default async function NewFollowUpPage({ searchParams }: PageProps<"/[lang]/reminders/new">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />}>
        <NewFollowUp lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewFollowUp({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[lang]/reminders/new">["searchParams"];
}) {
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" && /^[0-9a-f-]{36}$/i.test(sp.client) ? sp.client : null;
  const clients = await listClientOptions();
  const back = clientId ? `/${lang}/clients/${clientId}` : `/${lang}/reminders`;

  return (
    <>
      <header className="flex items-center gap-3">
        <Link href={back} aria-label={dict.followUp.cancel} className="-ml-2 rounded-md p-2 hover:bg-surface">
          <Icon name="arrow-left" />
        </Link>
        <h1 className="text-title">{dict.followUp.title}</h1>
      </header>
      <FollowUpForm
        lang={lang}
        t={dict.followUp}
        clients={clients}
        clientId={clients.some((c) => c.id === clientId) ? clientId : null}
        today={colomboToday()}
        back={back}
      />
    </>
  );
}
