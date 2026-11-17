"use client";

import { useActionState, useState, startTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { PAYMENT_METHODS } from "@/lib/types";
import { Button } from "@/components/button";
import { ErrorText, Field } from "@/components/form";
import { recordPaymentAction, type PaymentFormState } from "./actions";

/**
 * "Mark as paid" on the client profile: opens a small form with the premium,
 * cash and today filled in, so the usual case is still two taps, and a
 * different amount, a bank deposit or yesterday's date is one change.
 */
export function PayForm({
  policyId,
  premium,
  today,
  t,
}: {
  policyId: string;
  premium: number;
  today: string;
  t: Dictionary["payments"];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(async (prev, form) => {
    const result = await recordPaymentAction(prev, form);
    if (result.done) setOpen(false);
    return result;
  }, {});
  const v = state.values;

  if (!open) {
    return (
      <Button variant="outline" size="sm" icon="check" onClick={() => setOpen(true)}>
        {t.record}
      </Button>
    );
  }

  return (
    <form
      // Submitted by hand so a failed save keeps what was typed (React resets action forms).
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => action(form));
      }}
      className="flex w-full flex-col gap-4 rounded-md bg-bg p-3"
    >
      <input type="hidden" name="policy_id" value={policyId} />
      {state.error === "generic" && <ErrorText>{t.errors.generic}</ErrorText>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t.amount}
          name="amount"
          inputMode="decimal"
          required
          autoFocus
          defaultValue={v?.amount ?? String(premium)}
          error={state.error === "amount" ? t.errors.amount : undefined}
        />
        <Field
          label={t.paidOn}
          name="paid_on"
          type="date"
          required
          max={today}
          defaultValue={v?.paid_on ?? today}
          error={state.error === "paidOn" ? t.errors.paidOn : undefined}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-label font-medium text-muted">{t.method}</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className="cursor-pointer">
              <input type="radio" name="method" value={m} defaultChecked={(v?.method ?? "cash") === m} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3 text-caption font-medium text-text peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                {t.methods[m]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          {t.cancel}
        </Button>
        <Button type="submit" size="sm" variant="whatsapp" icon="check" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
