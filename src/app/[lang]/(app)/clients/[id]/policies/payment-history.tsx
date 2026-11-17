import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Payment } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { fill } from "@/lib/text";
import { ConfirmButton } from "@/components/confirm-button";
import { Icon } from "@/components/icons";
import { undoPaymentAction } from "./actions";

/** Latest payments for one policy, newest first, with undo on the newest. */
export function PaymentHistory({
  payments,
  shownLimit,
  lang,
  dict,
}: {
  payments: Payment[];
  shownLimit: number;
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.payments;
  const date = (d: string) => formatDate(d, dict.calendar, lang);
  if (payments.length === 0) return <p className="text-caption text-muted">{t.none}</p>;
  const [latest] = payments;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-caption text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          {fill(t.last, { amount: formatMoney(latest.amount, lang), date: date(latest.paid_on) })}
        </span>
        <span className="flex items-center gap-1 font-medium text-primary">
          {t.history} ({payments.length}
          {payments.length >= shownLimit ? "+" : ""})
          <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <ul className="mt-3 flex flex-col">
        {payments.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 border-t border-border py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium">{formatMoney(p.amount, lang)}</span>
              <span className="text-caption text-muted">
                {date(p.paid_on)} · {t.methods[p.method]} · {fill(t.forDue, { date: date(p.due_date) })}
              </span>
            </div>
            {i === 0 && (
              <ConfirmButton
                action={undoPaymentAction}
                fields={{ payment_id: p.id }}
                label={t.undo}
                confirmLabel={t.confirmUndo}
                icon="undo"
                confirmVariant="danger"
              />
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border pt-2 text-caption text-muted">
        {t.undoNote}
        {payments.length >= shownLimit && ` ${t.older}`}
      </p>
    </details>
  );
}
