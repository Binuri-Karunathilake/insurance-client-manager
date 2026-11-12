import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { listReminders, type Reminder } from "@/lib/data/reminders";
import { reminderMessage } from "@/lib/messages";
import { formatDate } from "@/lib/format";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import { ReminderCard } from "@/components/reminder-card";
import { ReminderAction } from "./reminder-actions";

export const metadata: Metadata = { title: "Reminders" };

const VIEWS = ["upcoming", "overdue"] as const;
type View = (typeof VIEWS)[number];

export default async function RemindersPage({ searchParams }: PageProps<"/[lang]/reminders">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-20 md:pb-0">
      <h1 className="text-title">{dict.reminders.title}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />}>
        <RemindersList lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function dayHeading(iso: string, days: number, lang: Locale, dict: Dictionary) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = dict.calendar.weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const prefix = days === 0 ? dict.reminders.today : days === 1 ? dict.reminders.tomorrow : weekday;
  return `${prefix} · ${formatDate(iso, dict.calendar, lang)}`;
}

async function RemindersList({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[lang]/reminders">["searchParams"];
}) {
  const sp = await searchParams;
  const view: View = sp.view === "overdue" ? "overdue" : "upcoming";
  const [user, all] = await Promise.all([getCurrentUser(), listReminders()]);
  const t = dict.reminders;

  const overdue = all.filter((r) => r.days_left < 0);
  const upcoming = all.filter((r) => r.days_left >= 0);
  const shown = view === "overdue" ? overdue : upcoming;
  const agent = user.name?.split(" ")[0] ?? null;

  // Group by day, keeping the view's order (oldest first).
  const days = new Map<string, Reminder[]>();
  for (const r of shown) days.set(r.due_on, [...(days.get(r.due_on) ?? []), r]);

  return (
    <>
      <p className="-mt-2 text-caption text-muted">{fill(t.summary, { n: upcoming.length, late: overdue.length })}</p>

      <nav aria-label={t.title} className="flex gap-1 rounded-md border border-border bg-surface p-1">
        {VIEWS.map((v) => {
          const count = v === "overdue" ? overdue.length : upcoming.length;
          const on = v === view;
          return (
            <Link
              key={v}
              href={`/${lang}/reminders${v === "upcoming" ? "" : "?view=overdue"}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-sm text-body ${
                on ? "bg-primary font-medium text-on-primary" : "text-muted hover:text-text"
              }`}
            >
              {t.views[v]}
              <span className={`text-caption ${on ? "" : v === "overdue" && count > 0 ? "font-medium text-danger" : ""}`}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">
          {view === "overdue" ? t.emptyOverdue : t.emptyUpcoming}
        </p>
      ) : (
        [...days].map(([day, items]) => (
          <section key={day} className="flex flex-col gap-3">
            <h2 className="pt-2 text-label font-medium tracking-wide text-muted uppercase">
              {dayHeading(day, items[0].days_left, lang, dict)}
            </h2>
            {items.map((r) => (
              <ReminderCard
                key={r.key}
                reminder={r}
                lang={lang}
                dict={dict}
                message={reminderMessage(r, agent)}
                actions={
                  r.kind === "birthday" ? undefined : (
                    <ReminderAction kind={r.kind} policyId={r.policy_id} followUpId={r.follow_up_id} t={dict.reminders} />
                  )
                }
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}
