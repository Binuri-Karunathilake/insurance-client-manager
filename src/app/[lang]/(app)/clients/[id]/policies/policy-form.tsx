"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Insurer, PaymentFrequency, Policy, PolicyType } from "@/lib/types";
import { RENEWS_YEARLY, nextDueDate, nextRenewalDate, paymentSchedule } from "@/lib/policy-dates";
import { formatDate, formatMoney } from "@/lib/format";
import { ErrorText, Field, SelectField } from "@/components/form";
import { Button, ButtonLink } from "@/components/button";
import { Icon } from "@/components/icons";
import { addInsurerAction, createPolicyAction, updatePolicyAction, type PolicyFormState } from "./actions";

const TYPES: PolicyType[] = ["life", "motor", "health", "property", "other"];
const FREQUENCIES: PaymentFrequency[] = ["monthly", "quarterly", "half_yearly", "yearly", "single"];
const STATUSES = ["active", "pending", "lapsed", "matured", "cancelled"] as const;

type Props = {
  lang: Locale;
  dict: Pick<Dictionary, "policyForm" | "policyTypes" | "policy" | "calendar">;
  clientId: string;
  insurers: Insurer[];
  /** Sri Lanka date (YYYY-MM-DD) from the server, so dates match the reminders. */
  today: string;
  policy?: Policy;
  cancelHref: string;
};

export function PolicyForm({ lang, dict, clientId, insurers: initialInsurers, today, policy, cancelHref }: Props) {
  const t = dict.policyForm;
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(
    policy ? updatePolicyAction : createPolicyAction,
    {},
  );
  const v = state.values;

  const [insurers, setInsurers] = useState(initialInsurers);
  const [insurerId, setInsurerId] = useState(v?.insurer_id ?? policy?.insurer_id ?? "");
  const [type, setType] = useState<PolicyType>((v?.type as PolicyType) ?? policy?.type ?? "life");
  const [frequency, setFrequency] = useState<PaymentFrequency>((v?.frequency as PaymentFrequency) ?? policy?.frequency ?? "monthly");
  const [start, setStart] = useState(v?.start_date ?? policy?.start_date ?? "");
  const [premium, setPremium] = useState(v?.premium ?? (policy ? String(policy.premium) : ""));

  // Due and renewal dates follow the start date until he types his own.
  const [dueOverride, setDueOverride] = useState<string | null>(v?.next_due_date ?? policy?.next_due_date ?? null);
  const [renewalOverride, setRenewalOverride] = useState<string | null>(v?.renewal_date ?? policy?.renewal_date ?? null);
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start);
  const autoDue = validStart ? nextDueDate(start, frequency, today) : null;
  const due = frequency === "single" ? null : (dueOverride ?? autoDue);
  const renews = RENEWS_YEARLY.includes(type);
  const renewal = renews ? (renewalOverride ?? (validStart ? nextRenewalDate(start, today) : null)) : renewalOverride;

  // An error disappears once its field is changed, and comes back only if
  // the next save still finds a problem.
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const err = (field: string) => {
    const key = state.errors?.[field];
    return key && !edited.has(field) ? t.errors[key] : undefined;
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <form
        // Submit by hand instead of action={...}: React resets a form after an
        // action, which would silently switch the dropdowns and dates back.
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setEdited(new Set());
          startTransition(() => action(data));
        }}
        onChange={(e) => {
          const name = (e.target as unknown as { name?: string }).name;
          if (name) setEdited((prev) => new Set(prev).add(name));
        }}
        className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
        noValidate
      >
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="client_id" value={clientId} />
        {policy && <input type="hidden" name="policy_id" value={policy.id} />}
        {state.formError && <ErrorText>{t.errors[state.formError]}</ErrorText>}

        <InsurerPicker
          t={t}
          insurers={insurers}
          value={insurerId}
          onChange={setInsurerId}
          onAdded={(ins) => {
            setInsurers((list) => [...list.filter((i) => i.id !== ins.id), { ...ins, branch: null }].sort((a, b) => a.name.localeCompare(b.name)));
            setInsurerId(ins.id);
          }}
          error={err("insurer_id")}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-label font-medium text-muted">{t.type}</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <label
                key={ty}
                className={`inline-flex h-10 cursor-pointer items-center rounded-full px-5 text-caption font-medium has-focus-visible:ring-2 has-focus-visible:ring-primary ${
                  type === ty ? "bg-primary-soft text-primary" : "border border-border bg-surface text-muted"
                }`}
              >
                <input type="radio" name="type" value={ty} checked={type === ty} onChange={() => setType(ty)} className="sr-only" />
                {dict.policyTypes[ty]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t.number}
            name="policy_number"
            autoCapitalize="characters"
            autoComplete="off"
            defaultValue={v?.policy_number ?? policy?.policy_number}
            error={err("policy_number")}
          />
          <Field
            label={t.sumAssured}
            name="sum_assured"
            inputMode="decimal"
            placeholder="1,500,000"
            defaultValue={v?.sum_assured ?? (policy?.sum_assured != null ? String(policy.sum_assured) : "")}
            error={err("sum_assured")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t.premium}
            name="premium"
            inputMode="decimal"
            placeholder="4,500"
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            error={err("premium")}
          />
          <SelectField
            label={t.frequency}
            name="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t.frequencies[f]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label={t.startDate}
            name="start_date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            error={err("start_date")}
          />
          {frequency !== "single" && (
            <Field
              label={t.nextDue}
              name="next_due_date"
              type="date"
              value={due ?? ""}
              onChange={(e) => setDueOverride(e.target.value || null)}
              error={err("next_due_date")}
            />
          )}
          {(renews || renewal) && (
            <Field
              label={t.renewal}
              name="renewal_date"
              type="date"
              value={renewal ?? ""}
              onChange={(e) => setRenewalOverride(e.target.value || null)}
              hint={renews ? t.renewalHint : undefined}
              error={err("renewal_date")}
            />
          )}
        </div>
        {frequency !== "single" && <p className="-mt-2 text-caption text-muted">{t.autoHint}</p>}

        <SelectField label={t.status} name="status" defaultValue={v?.status ?? policy?.status ?? "active"}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {dict.policy.status[s]}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <ButtonLink href={cancelHref} variant="outline">
            {t.cancel}
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : policy ? t.saveChanges : t.save}
          </Button>
        </div>
      </form>

      <Schedule
        t={t}
        dict={dict}
        lang={lang}
        dates={due && validStart ? paymentSchedule(due, start, frequency) : []}
        premium={Number(premium.replace(/rs\.?|,|\s/gi, "")) || null}
      />
    </div>
  );
}

function InsurerPicker({
  t,
  insurers,
  value,
  onChange,
  onAdded,
  error,
}: {
  t: Dictionary["policyForm"];
  insurers: Insurer[];
  value: string;
  onChange: (id: string) => void;
  onAdded: (insurer: { id: string; name: string }) => void;
  error?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (adding) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Field label={t.newInsurer} value={name} onChange={(e) => setName(e.target.value)} autoFocus error={addError ?? undefined} />
          <Button
            disabled={saving}
            className="mb-0 h-12"
            onClick={() =>
              startSaving(async () => {
                const result = await addInsurerAction(name);
                if ("error" in result) return setAddError(t.errors[result.error]);
                onAdded(result);
                setAdding(false);
                setName("");
                setAddError(null);
              })
            }
          >
            {saving ? t.adding : t.addInsurer}
          </Button>
        </div>
        <input type="hidden" name="insurer_id" value={value} />
      </div>
    );
  }

  return (
    <SelectField
      label={t.insurer}
      name="insurer_id"
      value={value}
      onChange={(e) => (e.target.value === "__add" ? setAdding(true) : onChange(e.target.value))}
      error={error}
    >
      <option value="" disabled>
        {t.chooseInsurer}
      </option>
      {insurers.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
      <option value="__add">{t.addInsurerOption}</option>
    </SelectField>
  );
}

function Schedule({
  t,
  dict,
  lang,
  dates,
  premium,
}: {
  t: Dictionary["policyForm"];
  dict: Pick<Dictionary, "calendar">;
  lang: Locale;
  dates: string[];
  premium: number | null;
}) {
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6 lg:w-80">
      <h2 className="flex items-center gap-2 text-heading">
        <Icon name="calendar" size={20} className="text-primary" />
        {t.schedule}
      </h2>
      {dates.length === 0 ? (
        <p className="text-caption text-muted">{t.scheduleEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {dates.map((d, i) => (
            <li key={d} className="flex justify-between border-b border-border py-2 last:border-b-0">
              <span className={i === 0 ? "font-medium" : ""}>{formatDate(d, dict.calendar, lang)}</span>
              {premium ? <span className="text-muted">{formatMoney(premium, lang)}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="rounded-md bg-primary-soft p-3 text-caption text-primary">{t.scheduleNote}</p>
    </aside>
  );
}
