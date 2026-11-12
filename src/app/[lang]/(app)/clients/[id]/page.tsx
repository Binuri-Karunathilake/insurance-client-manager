import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { getClientProfile, type ClientProfile } from "@/lib/data/clients";
import { formatPhone, maskNic, telLink, whatsappLink } from "@/lib/phone";
import { ageFrom, daysUntil, formatDate, formatMoney } from "@/lib/format";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import { Avatar, Chip, type Tone } from "@/components/chip";
import { ButtonAnchor, ButtonLink } from "@/components/button";
import { Icon } from "@/components/icons";
import { AddFamilyForm, AddNoteForm, RemoveButton } from "./tab-forms";

export const metadata: Metadata = { title: "Client" };

const TABS = ["policies", "family", "documents", "notes"] as const;
type Tab = (typeof TABS)[number];

export default async function ClientPage({ params, searchParams }: PageProps<"/[lang]/clients/[id]">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link href={`/${lang}/clients`} className="-ml-1 flex w-fit items-center gap-2 rounded-md px-1 py-1 text-body text-muted hover:text-text">
        <Icon name="arrow-left" size={20} />
        {dict.profile.back}
      </Link>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile lang={lang} dict={dict} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Profile({
  lang,
  dict,
  params,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  params: PageProps<"/[lang]/clients/[id]">["params"];
  searchParams: PageProps<"/[lang]/clients/[id]">["searchParams"];
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : "policies";
  const result = await getClientProfile(id);

  if (!result) {
    return <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.notFound}</p>;
  }
  const { client } = result;
  const counts: Record<Tab, number | null> = {
    policies: client.policies.length,
    family: client.family_members.length,
    documents: client.documents[0]?.count ?? 0,
    notes: client.client_notes.length,
  };

  return (
    <>
      <ClientHeader client={client} lang={lang} dict={dict} />

      <nav aria-label={client.full_name} className="-mx-4 flex gap-6 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/${lang}/clients/${client.id}${t === "policies" ? "" : `?tab=${t}`}`}
            scroll={false}
            aria-current={t === tab ? "page" : undefined}
            className={`flex shrink-0 flex-col gap-2 pt-2 text-body after:h-0.5 after:rounded-full ${
              t === tab ? "font-medium text-primary after:bg-primary" : "text-muted after:bg-transparent hover:text-text"
            }`}
          >
            <span>
              {dict.profile.tabs[t]} {counts[t] ? <span className="text-caption">{counts[t]}</span> : null}
            </span>
          </Link>
        ))}
      </nav>

      {tab === "policies" && <PoliciesTab client={client} lang={lang} dict={dict} />}
      {tab === "family" && <FamilyTab client={client} lang={lang} dict={dict} />}
      {tab === "documents" && <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.documentsSoon}</p>}
      {tab === "notes" && <NotesTab client={client} lang={lang} dict={dict} />}
    </>
  );
}

function ClientHeader({ client, lang, dict }: { client: ClientProfile; lang: Locale; dict: Dictionary }) {
  const t = dict.profile;
  const tel = telLink(client.mobile);
  const wa = whatsappLink(client.whatsapp ?? client.mobile);
  const details: [string, string][] = [[t.mobile, formatPhone(client.mobile)]];
  if (client.whatsapp) details.push([t.whatsappNumber, formatPhone(client.whatsapp)]);
  if (client.date_of_birth) {
    details.push([t.dob, `${formatDate(client.date_of_birth, dict.calendar, lang)} · ${fill(t.age, { n: ageFrom(client.date_of_birth) })}`]);
  }
  if (client.address) details.push([t.address, client.address]);
  details.push([t.clientSince, formatDate(client.created_at, dict.calendar, lang)]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex items-center gap-3 md:gap-4">
        <Avatar name={client.full_name} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-title break-words">{client.full_name}</h1>
          {client.nic && (
            <p className="text-caption text-muted">
              {t.nic} {maskNic(client.nic)}
            </p>
          )}
        </div>
        <ButtonLink href={`/${lang}/clients/${client.id}/edit`} variant="outline" icon="edit" aria-label={t.edit} className="w-11 px-0 md:w-auto md:px-4">
          <span className="hidden md:inline">{t.edit}</span>
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:justify-start">
        {tel && (
          <ButtonAnchor href={tel} variant="outline" icon="phone">
            {t.call}
          </ButtonAnchor>
        )}
        {wa && (
          <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="whatsapp" icon="message">
            {t.whatsapp}
          </ButtonAnchor>
        )}
      </div>

      <dl className="grid gap-3 border-t border-border pt-4 md:grid-cols-2 lg:grid-cols-4">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 md:flex-col md:justify-start md:gap-1">
            <dt className="text-caption text-muted">{label}</dt>
            <dd className="text-right text-body md:text-left">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PoliciesTab({ client, lang, dict }: { client: ClientProfile; lang: Locale; dict: Dictionary }) {
  return (
    <div className="flex flex-col gap-3">
      {client.policies.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.noPolicies}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {client.policies.map((p) => (
            <PolicyCard key={p.id} policy={p} lang={lang} dict={dict} />
          ))}
        </div>
      )}
      <ButtonLink href={`/${lang}/clients/${client.id}/policies/new`} variant="secondary" icon="plus" className="w-full md:w-auto md:self-start">
        {dict.profile.addPolicy}
      </ButtonLink>
    </div>
  );
}

function policyChip(policy: ClientProfile["policies"][number], t: Dictionary["policy"]): [Tone, string] {
  if (policy.status !== "active") return [policy.status === "pending" ? "primary" : "neutral", t.status[policy.status]];
  if (policy.next_due_date) {
    const days = daysUntil(policy.next_due_date);
    if (days < 0) return ["danger", fill(t.overdueBy, { n: -days })];
    if (days === 0) return ["warning", t.dueToday];
    if (days === 1) return ["warning", t.dueTomorrow];
    if (days <= 7) return ["warning", fill(t.dueIn, { n: days })];
  }
  if (policy.renewal_date) {
    const days = daysUntil(policy.renewal_date);
    if (days < 0) return ["danger", fill(t.overdueBy, { n: -days })];
    if (days <= 30) return ["primary", fill(t.renewalIn, { n: days })];
  }
  return ["success", t.status.active];
}

function PolicyCard({ policy, lang, dict }: { policy: ClientProfile["policies"][number]; lang: Locale; dict: Dictionary }) {
  const t = dict.policy;
  const [tone, label] = policyChip(policy, t);
  const rows: [string, string][] = [
    [t.number, policy.policy_number],
    [
      t.premium,
      policy.frequency === "single"
        ? `${formatMoney(policy.premium)} · ${t.frequency.single}`
        : `${formatMoney(policy.premium)} ${t.frequency[policy.frequency]}`,
    ],
  ];
  if (policy.sum_assured) rows.push([t.sumAssured, formatMoney(policy.sum_assured)]);
  if (policy.next_due_date) rows.push([t.nextDue, formatDate(policy.next_due_date, dict.calendar, lang)]);
  if (policy.renewal_date) rows.push([t.renewal, formatDate(policy.renewal_date, dict.calendar, lang)]);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-body font-medium">{dict.policyTypes[policy.type]}</h2>
          <p className="truncate text-caption text-muted">{policy.insurer?.name ?? t.insurerUnknown}</p>
        </div>
        <Chip tone={tone}>{label}</Chip>
      </header>
      <dl className="flex flex-col gap-2 border-t border-border pt-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-caption text-muted">{k}</dt>
            <dd className="text-right text-body font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function FamilyTab({ client, lang, dict }: { client: ClientProfile; lang: Locale; dict: Dictionary }) {
  const t = dict.family;
  const relationship = (r: string) => (r in t.relationships ? t.relationships[r as keyof typeof t.relationships] : r);
  return (
    <div className="flex flex-col gap-3">
      {client.family_members.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.noFamily}</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {client.family_members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <Avatar name={m.full_name} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium">{m.full_name}</span>
                <span className="text-caption text-muted">
                  {relationship(m.relationship)}
                  {m.date_of_birth &&
                    ` · ${formatDate(m.date_of_birth, dict.calendar, lang)} · ${fill(dict.profile.age, { n: ageFrom(m.date_of_birth) })}`}
                </span>
              </div>
              <RemoveButton table="family_members" id={m.id} label={t.remove} confirmLabel={t.confirmRemove} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted">{t.birthdayNote}</p>
      <AddFamilyForm clientId={client.id} t={t} />
    </div>
  );
}

function NotesTab({ client, lang, dict }: { client: ClientProfile; lang: Locale; dict: Dictionary }) {
  return (
    <div className="flex flex-col gap-3">
      <AddNoteForm clientId={client.id} t={dict.notes} />
      {client.client_notes.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.noNotes}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {client.client_notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-label font-medium text-muted">{formatDate(n.created_at, dict.calendar, lang)}</span>
                <RemoveButton table="client_notes" id={n.id} label={dict.notes.remove} confirmLabel={dict.notes.confirmRemove} />
              </div>
              <p className="text-body whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="h-10 w-2/3 animate-pulse rounded bg-border" />
      <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
    </div>
  );
}
