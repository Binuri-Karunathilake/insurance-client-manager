"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { markPaidAction } from "./actions";

export function MarkPaidButton({ policyId, label, confirmLabel }: { policyId: string; label: string; confirmLabel: string }) {
  return <ConfirmButton action={markPaidAction} fields={{ policy_id: policyId }} label={label} confirmLabel={confirmLabel} />;
}
