"use client";

import type { Dictionary } from "@/lib/i18n";
import type { Reminder } from "@/lib/data/reminders";
import { ConfirmButton } from "@/components/confirm-button";
import { markPaidAction } from "../clients/[id]/policies/actions";
import { completeFollowUpAction, markRenewedAction } from "./actions";

/** The one action that settles a reminder: paid, renewed or done. Birthdays have none. */
export function ReminderAction({
  kind,
  policyId,
  followUpId,
  t,
}: {
  kind: Reminder["kind"];
  policyId: string | null;
  followUpId: string | null;
  t: Dictionary["reminders"];
}) {
  if (kind === "premium" && policyId) {
    return <ConfirmButton action={markPaidAction} fields={{ policy_id: policyId }} label={t.paid} confirmLabel={t.confirmPaid} />;
  }
  if (kind === "renewal" && policyId) {
    return (
      <ConfirmButton action={markRenewedAction} fields={{ policy_id: policyId }} label={t.renewed} confirmLabel={t.confirmRenewed} icon="refresh" />
    );
  }
  if (kind === "follow_up" && followUpId) {
    return (
      <ConfirmButton action={completeFollowUpAction} fields={{ follow_up_id: followUpId }} label={t.done} confirmLabel={t.confirmDone} />
    );
  }
  return null;
}
