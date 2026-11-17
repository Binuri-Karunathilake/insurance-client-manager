"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonStyle } from "./button";
import type { IconName } from "./icons";

/**
 * A small form that runs a server action only after a second tap, so
 * nothing is marked paid, renewed or done by a slip of the thumb.
 */
export function ConfirmButton({
  action,
  fields,
  label,
  confirmLabel,
  icon = "check",
  confirmVariant = "whatsapp",
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirmLabel: string;
  icon?: IconName;
  confirmVariant?: ButtonStyle;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <form action={action} onBlur={() => setArmed(false)} onSubmit={() => setArmed(false)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {armed ? (
        <Confirm label={confirmLabel} icon={icon} variant={confirmVariant} />
      ) : (
        <Button variant="outline" size="sm" icon={icon} onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}
    </form>
  );
}

function Confirm({ label, icon, variant }: { label: string; icon: IconName; variant: ButtonStyle }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" icon={icon} variant={variant} autoFocus disabled={pending}>
      {label}
    </Button>
  );
}
