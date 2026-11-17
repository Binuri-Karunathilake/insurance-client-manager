"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Client } from "@/lib/types";
import { ErrorText, Field, SelectField, TextArea } from "@/components/form";
import { Button, ButtonLink } from "@/components/button";
import { createFollowUpAction, type FollowUpState } from "../actions";

export function FollowUpForm({
  lang,
  t,
  clients,
  clientId,
  today,
  back,
}: {
  lang: Locale;
  t: Dictionary["followUp"];
  clients: Pick<Client, "id" | "full_name" | "mobile">[];
  clientId: string | null;
  today: string;
  back: string;
}) {
  const [state, action, pending] = useActionState<FollowUpState, FormData>(createFollowUpAction, {});
  const v = state.values;
  const err = (f: keyof NonNullable<FollowUpState["errors"]>) => {
    const key = state.errors?.[f] as keyof typeof t.errors | undefined;
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="back" value={back} />
      {err("form") && <ErrorText>{err("form")}</ErrorText>}

      <SelectField label={t.client} name="client_id" defaultValue={v?.client_id ?? clientId ?? ""} error={err("client_id")}>
        <option value="" disabled>
          {t.chooseClient}
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name} · {c.mobile}
          </option>
        ))}
      </SelectField>

      <Field label={t.date} name="due_date" type="date" min={today} defaultValue={v?.due_date ?? today} error={err("due_date")} />

      <TextArea
        label={t.note}
        name="note"
        rows={3}
        maxLength={300}
        placeholder={t.notePlaceholder}
        autoFocus={!!clientId}
        defaultValue={v?.note}
        error={err("note")}
      />

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <ButtonLink href={back} variant="outline">
          {t.cancel}
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
