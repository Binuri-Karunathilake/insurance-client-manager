import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Reminder } from "@/lib/data/reminders";
import { formatMoney } from "@/lib/format";
import { telLink, whatsappLink } from "@/lib/phone";
import { fill } from "@/lib/text";
import { ButtonAnchor } from "./button";
import { Chip, type Tone } from "./chip";
import { Icon, type IconName } from "./icons";

// Figma "Reminder card": icon tile, client, what's due, a when-chip, and
// Call / WhatsApp buttons. Extra actions (Mark as paid, Done) go in `actions`.

const look: Record<Reminder["kind"], { icon: IconName; tile: string; tone: Tone }> = {
  premium: { icon: "calendar", tile: "bg-warning-soft text-warning", tone: "warning" },
  renewal: { icon: "refresh", tile: "bg-primary-soft text-primary", tone: "primary" },
  birthday: { icon: "cake", tile: "bg-success-soft text-success", tone: "success" },
  follow_up: { icon: "bell", tile: "bg-bg text-muted", tone: "neutral" },
};

export function whenLabel(days: number, t: Dictionary["reminders"]) {
  if (days < -1) return fill(t.daysLate, { n: -days });
  if (days === -1) return t.dayLate;
  if (days === 0) return t.today;
  if (days === 1) return t.tomorrow;
  return fill(t.inDays, { n: days });
}

function detail(r: Reminder, lang: Locale, dict: Dictionary) {
  const t = dict.reminders;
  const type = r.policy ? dict.policyTypes[r.policy.type] : "";
  switch (r.kind) {
    case "premium":
      return fill(t.premium, { type, amount: r.policy ? formatMoney(r.policy.premium, lang) : "" });
    case "renewal":
      return fill(t.renewal, { type });
    case "birthday": {
      if (!r.family) return fill(t.birthday, { n: r.detail ?? "" });
      const rel = r.family.relationship in dict.family.relationships
        ? dict.family.relationships[r.family.relationship as keyof typeof dict.family.relationships]
        : r.family.relationship;
      return fill(t.familyBirthday, { member: r.family.full_name, relationship: rel, n: r.detail ?? "" });
    }
    default:
      return r.detail ?? "";
  }
}

export function ReminderCard({
  reminder: r,
  lang,
  dict,
  message,
  actions,
}: {
  reminder: Reminder;
  lang: Locale;
  dict: Dictionary;
  /** Prefilled WhatsApp text, if any. */
  message: string | null;
  actions?: ReactNode;
}) {
  const t = dict.reminders;
  const late = r.days_left < 0;
  const style = look[r.kind];
  const tel = telLink(r.client.mobile);
  const wa = whatsappLink(r.client.whatsapp ?? r.client.mobile, message ?? undefined);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${late ? "bg-danger-soft text-danger" : style.tile}`}>
          <Icon name={late ? "alert" : style.icon} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link href={`/${lang}/clients/${r.client.id}`} className="truncate text-body font-medium hover:underline">
            {r.client.full_name}
          </Link>
          <p className="text-caption text-muted">{detail(r, lang, dict)}</p>
        </div>
        <Chip tone={late ? "danger" : style.tone}>{whenLabel(r.days_left, t)}</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        {tel && (
          <ButtonAnchor href={tel} variant="outline" icon="phone" className="flex-1">
            {t.call}
          </ButtonAnchor>
        )}
        {wa && (
          <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="whatsapp" icon="message" className="flex-1">
            {t.whatsapp}
          </ButtonAnchor>
        )}
      </div>
      {actions && <div className="flex justify-end gap-2 border-t border-border pt-3">{actions}</div>}
    </article>
  );
}
