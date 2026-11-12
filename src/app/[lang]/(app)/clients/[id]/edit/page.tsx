import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { getClientProfile } from "@/lib/data/clients";
import type { Locale } from "@/lib/locales";
import { Icon } from "@/components/icons";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/[lang]/clients/[id]/edit">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />}>
        <EditClient lang={lang} dict={dict} params={params} />
      </Suspense>
    </div>
  );
}

async function EditClient({
  lang,
  dict,
  params,
}: {
  lang: Locale;
  dict: Dictionary;
  params: PageProps<"/[lang]/clients/[id]/edit">["params"];
}) {
  const { id } = await params;
  const result = await getClientProfile(id);
  if (!result) return <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.notFound}</p>;
  const back = `/${lang}/clients/${id}`;

  return (
    <>
      <header className="flex items-center gap-3">
        <Link href={back} aria-label={result.client.full_name} className="-ml-2 rounded-md p-2 hover:bg-surface">
          <Icon name="arrow-left" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title">{dict.clientForm.editTitle}</h1>
          <p className="truncate text-caption text-muted">{result.client.full_name}</p>
        </div>
      </header>
      <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
        <ClientForm lang={lang} t={dict.clientForm} client={result.client} cancelHref={back} />
      </section>
    </>
  );
}
