import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { listAddedToday } from "@/lib/data/clients";
import { formatPhone } from "@/lib/phone";
import type { Locale } from "@/lib/locales";
import { Avatar } from "@/components/chip";
import { Icon } from "@/components/icons";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.clientForm;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href={`/${lang}/clients`} aria-label={dict.nav.clients} className="-ml-2 rounded-md p-2 hover:bg-surface">
          <Icon name="arrow-left" />
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-title">{t.newTitle}</h1>
          <p className="text-caption text-muted">{t.newIntro}</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex-1 rounded-lg border border-border bg-surface p-4 md:p-6">
          <ClientForm lang={lang} t={t} cancelHref={`/${lang}/clients`} />
        </section>
        <aside className="rounded-lg border border-border bg-surface p-4 lg:w-80">
          <h2 className="pb-2 text-heading">{t.addedToday}</h2>
          <Suspense fallback={<div className="h-24 animate-pulse rounded-md bg-bg" />}>
            <AddedToday lang={lang} dict={dict} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

async function AddedToday({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const clients = await listAddedToday();
  if (clients.length === 0) return <p className="text-caption text-muted">{dict.clientForm.addedTodayEmpty}</p>;
  return (
    <ul className="-mx-2 flex flex-col">
      {clients.map((c) => (
        <li key={c.id}>
          <Link href={`/${lang}/clients/${c.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-bg">
            <Avatar name={c.full_name} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium">{c.full_name}</span>
              <span className="text-caption text-muted">{formatPhone(c.mobile)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
