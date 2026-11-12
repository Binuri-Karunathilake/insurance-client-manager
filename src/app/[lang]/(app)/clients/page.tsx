import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { CLIENT_FILTERS, PAGE_SIZE, listClients, type ClientFilter, type ClientListRow } from "@/lib/data/clients";
import { formatPhone } from "@/lib/phone";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import type { ClientStatus } from "@/lib/types";
import { Avatar, Chip, type Tone } from "@/components/chip";
import { ButtonLink } from "@/components/button";
import { Icon } from "@/components/icons";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Clients" };

const statusTone: Record<ClientStatus, Tone> = { overdue: "danger", due: "warning", birthday: "success", lapsed: "neutral" };

export default async function ClientsPage({ searchParams }: PageProps<"/[lang]/clients">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-20 md:pb-0">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-title">{dict.clients.title}</h1>
        <div className="hidden md:block">
          <ButtonLink href={`/${lang}/clients/new`} icon="plus">
            {dict.clients.add}
          </ButtonLink>
        </div>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <ClientList lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>

      {/* Phone: floating button above the bottom navigation. */}
      <div className="fixed right-4 bottom-28 z-10 md:hidden">
        <ButtonLink
          href={`/${lang}/clients/new`}
          icon="plus"
          className="h-13 rounded-full px-5 shadow-[0_4px_12px_rgba(17,24,39,0.18)]"
        >
          {dict.clients.add}
        </ButtonLink>
      </div>
    </div>
  );
}

async function ClientList({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[lang]/clients">["searchParams"];
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const filter = (CLIENT_FILTERS as readonly string[]).includes(String(params.filter)) ? (params.filter as ClientFilter) : "all";
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, PAGE_SIZE), 1000);

  const { rows, total } = await listClients({ q, filter, limit });
  const href = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { q, filter, ...next };
    if (merged.q) sp.set("q", String(merged.q));
    if (merged.filter && merged.filter !== "all") sp.set("filter", String(merged.filter));
    if (merged.limit && Number(merged.limit) > PAGE_SIZE) sp.set("limit", String(merged.limit));
    const s = sp.toString();
    return `/${lang}/clients${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SearchBox placeholder={dict.clients.search} initial={q} />

      <nav aria-label={dict.clients.title} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {CLIENT_FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ filter: f, limit: undefined })}
            aria-current={f === filter ? "page" : undefined}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-caption font-medium ${
              f === filter ? "bg-primary-soft text-primary" : "border border-border bg-surface text-muted"
            }`}
          >
            {dict.clients.filters[f]}
          </Link>
        ))}
      </nav>

      <p className="text-caption text-muted">
        {total === 1 ? dict.clients.countOne : fill(dict.clients.count, { n: total })}
      </p>

      {rows.length === 0 ? (
        <Empty dict={dict} q={q} filter={filter} lang={lang} />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <ClientRow client={c} lang={lang} dict={dict} />
            </li>
          ))}
        </ul>
      )}

      {rows.length < total && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-caption text-muted">{fill(dict.clients.showing, { shown: rows.length, total })}</p>
          <ButtonLink href={href({ limit: limit + PAGE_SIZE })} variant="outline" scroll={false}>
            {dict.clients.showMore}
          </ButtonLink>
        </div>
      )}
    </>
  );
}

function ClientRow({ client, lang, dict }: { client: ClientListRow; lang: Locale; dict: Dictionary }) {
  const live = client.policies.filter((p) => p.status !== "cancelled");
  const summary =
    live.length === 0
      ? dict.clients.noPolicies
      : live.length === 1
        ? dict.policyTypes[live[0].type]
        : fill(dict.clients.policiesCount, { n: live.length });

  return (
    <Link href={`/${lang}/clients/${client.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
      <Avatar name={client.full_name} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-medium">{client.full_name}</span>
        <span className="truncate text-caption text-muted">
          {summary} · {formatPhone(client.mobile)}
        </span>
      </span>
      {client.status && <Chip tone={statusTone[client.status]}>{dict.clients.status[client.status]}</Chip>}
      <Icon name="chevron-right" size={20} className="shrink-0 text-muted" />
    </Link>
  );
}

function Empty({ dict, q, filter, lang }: { dict: Dictionary; q: string; filter: ClientFilter; lang: Locale }) {
  if (q) return <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{fill(dict.clients.noMatch, { q })}</p>;
  if (filter !== "all") return <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.clients.noFilterMatch}</p>;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
      <h2 className="text-heading">{dict.clients.emptyTitle}</h2>
      <p className="text-body text-muted">{dict.clients.emptyBody}</p>
      <ButtonLink href={`/${lang}/clients/new`} icon="plus">
        {dict.clients.add}
      </ButtonLink>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="h-12 animate-pulse rounded-md bg-border" />
      <div className="h-9 w-2/3 animate-pulse rounded-full bg-border" />
      <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
    </div>
  );
}
