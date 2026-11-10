import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Icon, type IconName } from "@/components/icons";
import { LanguageSwitch, SignOutButton } from "@/components/session-controls";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <LanguageSwitch lang={lang} label={dict.app.switchLanguage} />
        <SignOutButton lang={lang} label={dict.app.signOut} />
      </div>

      <Suspense fallback={<HeaderSkeleton />}>
        <Greeting dict={dict} />
      </Suspense>

      <Suspense fallback={<StatsSkeleton />}>
        <Stats dict={dict} />
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
    <header className="flex flex-col gap-1">
      <p className="text-caption text-muted">{`${weekdays[now.weekday]}, ${now.day} ${months[now.month]}`}</p>
      <h1 className="text-title">{name ? `${greeting}, ${name}` : greeting}</h1>
    </header>
  );
}

type DueItem = { kind: "premium" | "renewal" | "birthday" | "follow_up"; days_left: number };

async function Stats({ dict }: { dict: Dictionary }) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("due_items").select("kind, days_left").returns<DueItem[]>();

  if (error) {
    return <p className="rounded-md bg-danger-soft p-4 text-body text-danger">{dict.today.loadError}</p>;
  }

  const items = data ?? [];
  const count = (fn: (i: DueItem) => boolean) => items.filter(fn).length;
  const tiles: { icon: IconName; tone: string; value: number; label: string }[] = [
    { icon: "calendar", tone: "text-warning", value: count((i) => i.kind === "premium" && i.days_left >= 0), label: dict.today.premiumsDue },
    { icon: "refresh", tone: "text-primary", value: count((i) => i.kind === "renewal" && i.days_left >= 0), label: dict.today.renewals },
    { icon: "cake", tone: "text-success", value: count((i) => i.kind === "birthday"), label: dict.today.birthdays },
    { icon: "alert", tone: "text-danger", value: count((i) => i.days_left < 0), label: dict.today.overdue },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
          <Icon name={t.icon} size={20} className={t.tone} />
          <span className={`text-stat ${t.tone}`}>{t.value}</span>
          <span className="text-caption text-muted">{t.label}</span>
        </div>
      ))}
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="h-4 w-40 animate-pulse rounded bg-border" />
      <div className="h-7 w-64 animate-pulse rounded bg-border" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}
