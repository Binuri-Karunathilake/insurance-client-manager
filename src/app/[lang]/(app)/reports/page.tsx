import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { getMonthlyReport } from "@/lib/data/report";
import { colomboToday, daysUntil, formatDate, formatMoney, formatMonth } from "@/lib/format";
import { monthRange, pickMonth, shiftMonth, summarize, monthOf, type Group } from "@/lib/report";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import { Avatar, Chip } from "@/components/chip";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Monthly report" };

export default async function ReportPage({ searchParams }: PageProps<"/[lang]/reports">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-title">{dict.report.title}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />}>
        <Report lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Report({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[lang]/reports">["searchParams"];
}) {
  const t = dict.report;
  const sp = await searchParams;
  await connection(); // "this month" is read at request time, never baked into a prebuilt page
  const current = monthOf(colomboToday());
  const month = pickMonth(sp.month, current);
  const { payments, previousTotal, unpaid, unpaidTotal } = await getMonthlyReport(month);
  const s = summarize(payments);
  const money = (n: number) => formatMoney(n, lang);
  const date = (d: string) => formatDate(d, dict.calendar, lang);
  const shortDate = (d: string) => {
    const [day, mon] = [+d.slice(8, 10), dict.calendar.monthsShort[+d.slice(5, 7) - 1]];
    return lang === "si" ? `${mon} ${day}` : `${day} ${mon}`;
  };
  const monthEnd = monthRange(month).last;
  const href = (m: string) => `/${lang}/reports${m === current ? "" : `?month=${m}`}`;

  return (
    <>
      <nav aria-label={t.title} className="flex items-center gap-2">
        <Link href={href(shiftMonth(month, -1))} aria-label={t.prev} className="flex size-11 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-text">
          <Icon name="chevron-left" size={20} />
        </Link>
        <h2 className="flex-1 text-center text-heading">{formatMonth(month, dict.calendar, lang)}</h2>
        {month < current ? (
          <Link href={href(shiftMonth(month, 1))} aria-label={t.next} className="flex size-11 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-text">
            <Icon name="chevron-right" size={20} />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </nav>

      <section className="flex flex-col gap-1 rounded-lg bg-primary p-5 text-on-primary">
        <span className="text-caption opacity-80">{t.collected}</span>
        <span className="text-[32px] leading-10 font-semibold">{money(s.total)}</span>
        <span className="text-caption opacity-80">
          {s.count === 1 ? t.countOne : fill(t.count, { n: s.count })} ·{" "}
          {fill(t.lastMonth, { amount: money(previousTotal), month: formatMonth(shiftMonth(month, -1), dict.calendar, lang) })}
        </span>
      </section>

      {s.count > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Breakdown title={t.byInsurer} groups={s.byInsurer} label={(k) => k || dict.policy.insurerUnknown} money={money} />
          <div className="flex flex-col gap-4">
            <Breakdown title={t.byType} groups={s.byType} label={(k) => dict.policyTypes[k as keyof Dictionary["policyTypes"]] ?? k} money={money} />
            <Breakdown title={t.byMethod} groups={s.byMethod} label={(k) => dict.payments.methods[k as keyof Dictionary["payments"]["methods"]] ?? k} money={money} />
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-heading">{t.stillUnpaid}</h2>
        {unpaid.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-body text-muted">{fill(t.allPaid, { date: date(monthEnd) })}</p>
        ) : (
          <>
            <p className="text-caption text-muted">{fill(t.stillUnpaidIntro, { date: date(monthEnd), amount: money(unpaidTotal) })}</p>
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {unpaid.map((p) => {
                const days = daysUntil(p.next_due_date);
                return (
                  <li key={p.id} className="border-b border-border last:border-b-0">
                    <Link href={`/${lang}/clients/${p.client?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                      <Avatar name={p.client?.full_name ?? "?"} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body font-medium">{p.client?.full_name}</span>
                        <span className="truncate text-caption text-muted">
                          {dict.policyTypes[p.type]} · {p.insurer?.name ?? dict.policy.insurerUnknown} · {money(p.premium)}
                        </span>
                      </div>
                      {days < 0 ? (
                        <Chip tone="danger">{fill(t.late, { n: -days })}</Chip>
                      ) : (
                        <Chip tone="warning">{fill(t.due, { date: shortDate(p.next_due_date) })}</Chip>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading">{t.list}</h2>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-body text-muted">{fill(t.none, { month: formatMonth(month, dict.calendar, lang) })}</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {payments.map((p) => (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <Link href={`/${lang}/clients/${p.client?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium">{p.client?.full_name}</span>
                    <span className="truncate text-caption text-muted">
                      {date(p.paid_on)} · {p.policy ? dict.policyTypes[p.policy.type] : ""} · {dict.payments.methods[p.method]}
                    </span>
                  </div>
                  <span className="text-body font-medium">{money(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Breakdown({
  title,
  groups,
  label,
  money,
}: {
  title: string;
  groups: Group[];
  label: (key: string) => string;
  money: (n: number) => string;
}) {
  const max = Math.max(...groups.map((g) => g.total), 1);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-body font-medium">{title}</h2>
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body">
                {label(g.key)} <span className="text-caption text-muted">· {g.count}</span>
              </span>
              <span className="shrink-0 text-body font-medium">{money(g.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (g.total / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
