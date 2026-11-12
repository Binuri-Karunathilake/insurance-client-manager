import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { listReminders, type Reminder } from "@/lib/data/reminders";
import { reminderMessage } from "@/lib/messages";
import type { Locale } from "@/lib/locales";
import { Avatar, Chip } from "@/components/chip";
import { ButtonLink } from "@/components/button";
import { Icon, type IconName } from "@/components/icons";
import { ReminderCard, whenLabel } from "@/components/reminder-card";
import { LanguageSwitch, SignOutButton } from "@/components/session-controls";
import { ReminderAction } from "./reminders/reminder-actions";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <LanguageSwitch lang={lang} label={dict.app.switchLanguage} />
        <SignOutButton lang={lang} label={dict.app.signOut} />
      </div>

      <div className="flex items-center gap-3">
        <Suspense fallback={<HeaderSkeleton />}>
          <Greeting dict={dict} />
        </Suspense>
        <div className="hidden md:block">
          <ButtonLink href={`/${lang}/clients/new`} icon="plus">
            {dict.today.addClient}
          </ButtonLink>
        </div>
      </div>

      <Suspense fallback={<BodySkeleton />}>
        <TodayBody lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

/** Sri Lanka time, whatever time zone the server runs in. */
function colomboNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "numeric",
    hourCycle: "h23",
    day: "numeric",
    month: "numeric",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { hour: Number(get("hour")), day: Number(get("day")), month: Number(get("month")) - 1, weekday };
}

async function Greeting({ dict }: { dict: Dictionary }) {
  const user = await getCurrentUser();
  const name = user.name?.split(" ")[0];
  const now = colomboNow();
  const greeting =
    now.hour < 12 ? dict.today.greetingMorning : now.hour < 17 ? dict.today.greetingAfternoon : dict.today.greetingEvening;
  const { weekdays, months } = dict.calendar;
  return (
    <header className="flex flex-1 flex-col gap-1">
      <p className="text-caption text-muted">{`${weekdays[now.weekday]}, ${now.day} ${months[now.month]}`}</p>
      <h1 className="text-title">{name ? `${greeting}, ${name}` : greeting}</h1>
    </header>
  );
}

async function TodayBody({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.today;
  let all: Reminder[];
  try {
    all = await listReminders();
  } catch {
    return <p className="rounded-md bg-danger-soft p-4 text-body text-danger">{t.loadError}</p>;
  }
  const user = await getCurrentUser();
  const agent = user.name?.split(" ")[0] ?? null;

  const overdue = all.filter((r) => r.days_left < 0);
  const week = all.filter((r) => r.days_left >= 0 && r.days_left <= 7 && r.kind !== "birthday");
  const birthdays = all.filter((r) => r.kind === "birthday");
  const laterRenewals = all.filter((r) => r.kind === "renewal" && r.days_left > 7);

  const tiles: { icon: IconName; tone: string; value: number; label: string; href: string }[] = [
    { icon: "calendar", tone: "text-warning", value: week.filter((r) => r.kind === "premium").length, label: t.premiumsDue, href: "/reminders" },
    { icon: "refresh", tone: "text-primary", value: all.filter((r) => r.kind === "renewal" && r.days_left >= 0).length, label: t.renewals, href: "/reminders" },
    { icon: "cake", tone: "text-success", value: birthdays.length, label: t.birthdays, href: "/reminders" },
    { icon: "alert", tone: "text-danger", value: overdue.length, label: t.overdue, href: "/reminders?view=overdue" },
  ];

  const card = (r: Reminder) => (
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
  );

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={`/${lang}${tile.href}`}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3 hover:border-primary/40"
          >
            <Icon name={tile.icon} size={20} className={tile.tone} />
            <span className={`text-stat ${tile.tone}`}>{tile.value}</span>
            <span className="text-caption text-muted">{tile.label}</span>
          </Link>
        ))}
      </section>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {overdue.length > 0 && (
            <Section title={t.overdueList} href={`/${lang}/reminders?view=overdue`} more={t.seeAll}>
              {overdue.slice(0, 3).map(card)}
            </Section>
          )}
          <Section title={t.dueThisWeek} href={`/${lang}/reminders`} more={t.seeAll}>
            {week.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface p-4 text-body text-muted">{t.allClear}</p>
            ) : (
              week.slice(0, 4).map(card)
            )}
          </Section>
        </div>

        {(birthdays.length > 0 || laterRenewals.length > 0) && (
          <div className="flex flex-col gap-6 md:w-90">
            {birthdays.length > 0 && <Section title={t.birthdaysList}>{birthdays.map(card)}</Section>}
            {laterRenewals.length > 0 && (
              <Section title={t.renewalsList} href={`/${lang}/reminders`} more={t.seeAll}>
                <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                  {laterRenewals.slice(0, 5).map((r) => (
                    <li key={r.key} className="border-b border-border last:border-b-0">
                      <Link href={`/${lang}/clients/${r.client.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                        <Avatar name={r.client.full_name} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body font-medium">{r.client.full_name}</span>
                          <span className="text-caption text-muted">{r.policy ? dict.policyTypes[r.policy.type] : ""}</span>
                        </span>
                        <Chip tone="primary">{whenLabel(r.days_left, dict.reminders)}</Chip>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, href, more, children }: { title: string; href?: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-heading">{title}</h2>
        {href && more && (
          <Link href={href} className="text-body font-medium text-primary">
            {more}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2" aria-hidden="true">
      <div className="h-4 w-40 animate-pulse rounded bg-border" />
      <div className="h-7 w-64 animate-pulse rounded bg-border" />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
    </div>
  );
}
