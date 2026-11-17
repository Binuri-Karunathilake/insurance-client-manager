"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";
import { markPaidAction } from "./actions";

/** Two taps, so a premium is never marked paid by accident. */
export function MarkPaidButton({ policyId, label, confirmLabel }: { policyId: string; label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <form action={markPaidAction} onBlur={() => setArmed(false)} onSubmit={() => setArmed(false)}>
      <input type="hidden" name="policy_id" value={policyId} />
      {armed ? <Confirm label={confirmLabel} /> : (
        <Button variant="outline" size="sm" icon="check" onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}
    </form>
  );
}

function Confirm({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" icon="check" variant="whatsapp" autoFocus disabled={pending}>
      {label}
    </Button>
  );
}
