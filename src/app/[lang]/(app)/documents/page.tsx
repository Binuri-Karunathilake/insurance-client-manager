import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { listRecentDocuments } from "@/lib/data/documents";
import { listClientOptions } from "@/lib/data/clients";
import type { Locale } from "@/lib/locales";
import { DocumentGrid } from "@/components/document-grid";
import { Icon } from "@/components/icons";
import { Uploader } from "./uploader";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.documents;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{t.title}</h1>
        <p className="text-caption text-muted">{t.intro}</p>
      </header>
      <p className="flex items-center gap-2 rounded-md bg-primary-soft p-3 text-caption text-primary">
        <Icon name="lock" size={16} className="shrink-0" />
        {t.privacy}
      </p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />}>
        <Recent lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

async function Recent({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.documents;
  const [docs, clients] = await Promise.all([listRecentDocuments(), listClientOptions()]);
  const names = Object.fromEntries(clients.map((c) => [c.id, c.full_name]));
  return (
    <>
      <Uploader t={t} clients={clients.map(({ id, full_name }) => ({ id, full_name }))} />
      <h2 className="pt-2 text-heading">{t.recent}</h2>
      {docs.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{t.empty}</p>
      ) : (
        <DocumentGrid docs={docs} lang={lang} dict={dict} clientNames={names} />
      )}
    </>
  );
}
