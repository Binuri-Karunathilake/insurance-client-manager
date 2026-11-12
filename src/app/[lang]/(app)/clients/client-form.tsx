"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Client } from "@/lib/types";
import { fill } from "@/lib/text";
import { Checkbox, ErrorText, Field, SelectField, SuccessText, TextArea } from "@/components/form";
import { Button, ButtonLink } from "@/components/button";
import { createClientAction, updateClientAction, type ClientFormState } from "./actions";

type Props = {
  lang: Locale;
  t: Dictionary["clientForm"];
  /** Editing an existing client; leave out for a new one. */
  client?: Pick<Client, "id" | "full_name" | "mobile" | "whatsapp" | "nic" | "date_of_birth" | "address" | "preferred_language">;
  cancelHref: string;
};

export function ClientForm({ lang, t, client, cancelHref }: Props) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(
    client ? updateClientAction : createClientAction,
    {},
  );
  // A new key after "Save and add next" remounts the fields, clearing them.
  return <Fields key={state.saved?.count ?? 0} {...{ lang, t, client, cancelHref, state, action, pending }} />;
}

function Fields({
  lang,
  t,
  client,
  cancelHref,
  state,
  action,
  pending,
}: Props & { state: ClientFormState; action: (form: FormData) => void; pending: boolean }) {
  const v = state.values;
  const initialSame = v ? v.same_whatsapp === "on" : !client?.whatsapp;
  const [sameWhatsapp, setSameWhatsapp] = useState(initialSame);
  // An error disappears once its field is changed; a new save checks again.
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const err = (field: string) => {
    const key = state.errors?.[field];
    return key && !edited.has(field) ? t.errors[key] : undefined;
  };

  return (
    <form
      action={(data) => {
        setEdited(new Set());
        action(data);
      }}
      onChange={(e) => {
        const name = (e.target as unknown as { name?: string }).name;
        if (name) setEdited((prev) => new Set(prev).add(name));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="lang" value={lang} />
      {client && <input type="hidden" name="id" value={client.id} />}

      {state.saved && <SuccessText>{fill(t.savedNext, { name: state.saved.name })}</SuccessText>}
      {state.formError && <ErrorText>{t.errors[state.formError]}</ErrorText>}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`${t.fullName} *`}
          name="full_name"
          autoComplete="off"
          autoCapitalize="words"
          required
          autoFocus={!client}
          defaultValue={v?.full_name ?? client?.full_name}
          error={err("full_name")}
        />
        <Field
          label={`${t.mobile} *`}
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="077 123 4567"
          required
          defaultValue={v?.mobile ?? client?.mobile}
          error={err("mobile")}
        />
      </div>

      <Checkbox
        label={t.sameWhatsapp}
        name="same_whatsapp"
        // Uncontrolled: React resets forms after an action, and the reset must
        // land on what was submitted, not on the first render's value.
        defaultChecked={initialSame}
        onChange={(e) => setSameWhatsapp(e.target.checked)}
      />
      {!sameWhatsapp && (
        <Field
          label={t.whatsapp}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          placeholder="077 123 4567"
          defaultValue={v?.whatsapp ?? client?.whatsapp ?? ""}
          error={err("whatsapp")}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`${t.nic} (${t.optional})`}
          name="nic"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="197912345678"
          hint={t.nicHint}
          defaultValue={v?.nic ?? client?.nic ?? ""}
          error={err("nic")}
        />
        <Field
          label={`${t.dob} (${t.optional})`}
          name="date_of_birth"
          type="date"
          defaultValue={v?.date_of_birth ?? client?.date_of_birth ?? ""}
          error={err("date_of_birth")}
        />
      </div>

      <TextArea
        label={`${t.address} (${t.optional})`}
        name="address"
        rows={2}
        defaultValue={v?.address ?? client?.address ?? ""}
        error={err("address")}
      />

      <SelectField
        label={t.language}
        name="preferred_language"
        defaultValue={v?.preferred_language ?? client?.preferred_language ?? "si"}
      >
        <option value="si">{t.langSi}</option>
        <option value="en">{t.langEn}</option>
      </SelectField>

      {!client && (
        <Checkbox label={t.addPolicyAfter} name="add_policy" defaultChecked={v ? v.add_policy === "on" : true} />
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <ButtonLink href={cancelHref} variant="outline">
          {t.cancel}
        </ButtonLink>
        {client ? (
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : t.saveChanges}
          </Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="open" variant="outline" disabled={pending}>
              {t.save}
            </Button>
            <Button type="submit" name="intent" value="next" disabled={pending}>
              {pending ? t.saving : t.saveNext}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
