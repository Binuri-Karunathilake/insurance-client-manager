"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { ErrorText, Field, SelectField, TextArea } from "@/components/form";
import { Button } from "@/components/button";
import { RELATIONSHIPS } from "@/lib/family";
import { addFamilyMember, addNote, removeItem, type SmallFormState } from "./actions";

export function AddFamilyForm({ clientId, t }: { clientId: string; t: Dictionary["family"] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SmallFormState, FormData>(addFamilyMember, {});
  const v = state.values;

  if (!open) {
    return (
      <Button variant="secondary" icon="plus" onClick={() => setOpen(true)} className="w-full md:w-auto md:self-start">
        {t.add}
      </Button>
    );
  }

  return (
    <form key={state.done ?? 0} action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="client_id" value={clientId} />
      {state.error && <ErrorText>{t.errors[state.error as keyof typeof t.errors] ?? t.errors.generic}</ErrorText>}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t.name} name="full_name" required autoFocus autoCapitalize="words" defaultValue={v?.full_name} />
        <SelectField label={t.relationship} name="relationship" defaultValue={v?.relationship ?? "wife"}>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {t.relationships[r]}
            </option>
          ))}
        </SelectField>
        <Field label={t.dob} name="date_of_birth" type="date" defaultValue={v?.date_of_birth} />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}

export function AddNoteForm({ clientId, t }: { clientId: string; t: Dictionary["notes"] }) {
  const [state, action, pending] = useActionState<SmallFormState, FormData>(addNote, {});
  return (
    <form key={state.done ?? 0} action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="client_id" value={clientId} />
      {state.error && <ErrorText>{t.errors[state.error as keyof typeof t.errors] ?? t.errors.generic}</ErrorText>}
      <TextArea label={t.placeholder} name="body" rows={3} maxLength={2000} defaultValue={state.values?.body} />
      <div className="flex items-center gap-3">
        <p className="flex-1 text-caption text-warning">{t.noMedical}</p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}

/** Two taps to delete, so a slip of the thumb can't remove anything. */
export function RemoveButton({
  table,
  id,
  label,
  confirmLabel,
}: {
  table: "family_members" | "client_notes";
  id: string;
  label: string;
  confirmLabel: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <form action={removeItem} onBlur={() => setArmed(false)}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      {armed ? (
        <Button type="submit" variant="danger" size="sm" icon="trash" autoFocus>
          {confirmLabel}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setArmed(true)} aria-label={label} className="border-transparent text-muted">
          {label}
        </Button>
      )}
    </form>
  );
}
