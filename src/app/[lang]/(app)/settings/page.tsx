import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { notificationsConfigured } from "@/lib/notify";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import { Icon } from "@/components/icons";
import { DeviceToggle, PreferencesForm, SendTest } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-title">{dict.settings.title}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />}>
        <Settings lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
      <h2 className="text-heading">{title}</h2>
      {children}
    </section>
  );
}

async function Settings({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.settings;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: settings }, { data: devices }] = await Promise.all([
    supabase.from("notification_settings").select("email_enabled, language").maybeSingle(),
    supabase.from("push_subscriptions").select("device").order("created_at"),
  ]);
  const configured = notificationsConfigured();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const deviceNames = [...new Set(((devices ?? []) as { device: string | null }[]).map((d) => d.device).filter(Boolean))];

  return (
    <>
      <p className="-mt-2 text-body text-muted">{t.notificationsIntro}</p>
      {!configured.push && !configured.email && (
        <p className="rounded-md bg-warning-soft p-3 text-caption text-warning">{t.notConfigured}</p>
      )}

      {configured.push && vapidKey && (
        <Card title={t.deviceTitle}>
          <DeviceToggle t={t} vapidKey={vapidKey} />
          {deviceNames.length > 0 && <p className="text-caption text-muted">{fill(t.otherDevices, { devices: deviceNames.join(", ") })}</p>}
        </Card>
      )}

      <Card title={t.emailTitle}>
        <PreferencesForm
          t={t}
          emailEnabled={settings?.email_enabled ?? true}
          language={(settings?.language as "si" | "en" | undefined) ?? lang}
          email={user.email}
        />
      </Card>

      <Card title={dict.export.title}>
        <p className="-mt-2 text-body text-muted">{dict.export.intro}</p>
        <p className="rounded-md bg-warning-soft p-3 text-caption text-warning">{dict.export.warning}</p>
        <a
          href={`/${lang}/settings/export`}
          download
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-body font-medium text-on-primary hover:bg-primary/90"
        >
          <Icon name="download" size={20} />
          {dict.export.download}
        </a>
        <p className="text-caption text-muted">{dict.export.filesNote}</p>
      </Card>

      {(configured.push || configured.email) && (
        <Card title={t.testTitle}>
          <p className="-mt-2 text-caption text-muted">{t.testIntro}</p>
          <SendTest t={t} />
        </Card>
      )}
    </>
  );
}
