"use client";

import { useRef, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import { CLIENT_FIELDS, POLICY_FIELDS, guessMapping, type FieldKey, type Mapping, type RowOutcome } from "@/lib/import";
import { fill } from "@/lib/text";
import { Button, ButtonLink } from "@/components/button";
import { ErrorText, SelectField, SuccessText } from "@/components/form";
import { Icon } from "@/components/icons";
import { checkImportAction, readFileAction, runImportAction, type CheckResult, type RunResult } from "./actions";

type T = Dictionary["import"];
type Loaded = { fileName: string; headers: string[]; rows: string[][]; rowNumbers: number[] };
type Step = "file" | "map" | "check" | "done";

const column = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

export function ImportWizard({ t, lang }: { t: T; lang: Locale }) {
  const [step, setStep] = useState<Step>("file");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [check, setCheck] = useState<Extract<CheckResult, { counts: unknown }> | null>(null);
  const [done, setDone] = useState<Extract<RunResult, { clients: number }> | null>(null);
  const [error, setError] = useState<keyof T["errors"] | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const input = () => ({ headers: loaded!.headers, rows: loaded!.rows, rowNumbers: loaded!.rowNumbers, mapping });

  function readFile(file: File) {
    setError(null);
    const form = new FormData();
    form.append("file", file);
    start(async () => {
      const result = await readFileAction(form);
      if ("error" in result) return setError(result.error);
      setLoaded({ fileName: file.name, ...result });
      setMapping(guessMapping(result.headers));
      setStep("map");
    });
  }

  function runCheck() {
    setError(null);
    start(async () => {
      const result = await checkImportAction(input());
      if ("error" in result) return setError(result.error);
      setCheck(result);
      setStep("check");
    });
  }

  function runImport() {
    setError(null);
    start(async () => {
      const result = await runImportAction(input());
      if ("error" in result) return setError(result.error);
      setDone(result);
      setStep("done");
    });
  }

  function reset() {
    setStep("file");
    setLoaded(null);
    setCheck(null);
    setDone(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const stepIndex = { file: 0, map: 1, check: 2, done: 2 }[step];

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex gap-2">
        {t.steps.map((label, i) => (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-2">
            <span className={`h-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-border"}`} />
            <span className={`truncate text-label font-medium ${i === stepIndex ? "text-primary" : "text-muted"}`}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {error && <ErrorText>{t.errors[error]}</ErrorText>}

      {step === "file" && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
          <p className="text-body">{t.intro}</p>
          <div className="flex flex-col gap-2 rounded-md bg-bg p-3">
            <a
              href={`/${lang}/clients/import/template`}
              download
              className="inline-flex items-center gap-2 self-start text-body font-medium text-primary hover:underline"
            >
              <Icon name="download" size={20} />
              {t.template}
            </a>
            <p className="text-caption text-muted">{t.templateNote}</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
            }}
          />
          <Button icon="upload" onClick={() => fileInput.current?.click()} disabled={pending} className="self-start">
            {pending ? t.reading : t.choose}
          </Button>
          <p className="text-caption text-muted">{t.fileHint}</p>
          <p className="flex items-start gap-2 text-caption text-muted">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
            {t.privacy}
          </p>
        </section>
      )}

      {step === "map" && loaded && (
        <MapStep
          t={t}
          loaded={loaded}
          mapping={mapping}
          setMapping={(m) => {
            setMapping(m);
            setError(null);
          }}
          pending={pending}
          onBack={reset}
          onNext={runCheck}
        />
      )}

      {step === "check" && check && (
        <CheckStep t={t} check={check} pending={pending} onBack={() => setStep("map")} onImport={runImport} />
      )}

      {step === "done" && done && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
          <SuccessText>{fill(t.done, { clients: done.clients, policies: done.policies })}</SuccessText>
          {done.insurers > 0 && (
            <p className="text-body text-muted">{done.insurers === 1 ? t.doneInsurersOne : fill(t.doneInsurers, { n: done.insurers })}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/${lang}/clients`} icon="users">
              {t.viewClients}
            </ButtonLink>
            <Button variant="outline" icon="upload" onClick={reset}>
              {t.startOver}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function MapStep({
  t,
  loaded,
  mapping,
  setMapping,
  pending,
  onBack,
  onNext,
}: {
  t: T;
  loaded: Loaded;
  mapping: Mapping;
  setMapping: (m: Mapping) => void;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const example = (i: number | undefined) => (i === undefined ? undefined : loaded.rows.find((r) => r[i])?.[i]);
  const field = (f: FieldKey) => {
    const value = example(mapping[f]);
    return (
      <SelectField
        key={f}
        label={t.fields[f]}
        value={mapping[f] === undefined ? "" : String(mapping[f])}
        onChange={(e) => {
          const next = { ...mapping };
          if (e.target.value === "") delete next[f];
          else next[f] = Number(e.target.value);
          setMapping(next);
        }}
        hint={value ? fill(t.example, { value: value.length > 40 ? `${value.slice(0, 40)}…` : value }) : undefined}
      >
        <option value="">{t.notInFile}</option>
        {loaded.headers.map((h, i) => (
          <option key={i} value={i}>
            {column(i)} · {h || "—"}
          </option>
        ))}
      </SelectField>
    );
  };

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium">{fill(t.sheetInfo, { file: loaded.fileName, rows: loaded.rows.length })}</p>
        <p className="text-caption text-muted">{t.matchIntro}</p>
      </div>
      <fieldset className="flex flex-col gap-4">
        <legend className="pb-3 text-heading">{t.clientSection}</legend>
        <div className="grid gap-4 md:grid-cols-2">{CLIENT_FIELDS.map(field)}</div>
      </fieldset>
      <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
        <legend className="pb-3 text-heading">{t.policySection}</legend>
        <div className="grid gap-4 md:grid-cols-2">{POLICY_FIELDS.map(field)}</div>
        <p className="text-caption text-muted">{t.policyNote}</p>
      </fieldset>
      <div className="flex justify-between gap-3 border-t border-border pt-4">
        <Button variant="outline" icon="arrow-left" onClick={onBack}>
          {t.back}
        </Button>
        <Button onClick={onNext} disabled={pending}>
          {pending ? t.checking : t.check}
        </Button>
      </div>
    </section>
  );
}

function CheckStep({
  t,
  check,
  pending,
  onBack,
  onImport,
}: {
  t: T;
  check: Extract<CheckResult, { counts: unknown }>;
  pending: boolean;
  onBack: () => void;
  onImport: () => void;
}) {
  const c = check.counts;
  const tiles: [keyof T["summary"], number, string][] = [
    ["newClients", c.newClients, "text-primary"],
    ["newPolicies", c.newPolicies, "text-primary"],
    ["skipped", c.skipped, "text-muted"],
    ["problems", c.problems, c.problems ? "text-danger" : "text-muted"],
  ];
  const nothing = c.newClients + c.newPolicies === 0;
  const outcome = (o: Extract<RowOutcome, { kind: "add" }>) =>
    o.newClient ? (o.policy ? fill(t.outcome.newClientPolicy, { policy: o.policy }) : t.outcome.newClient) : fill(t.outcome.policy, { policy: o.policy ?? "" });

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([k, n, tone]) => (
          <div key={k} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <span className={`text-stat ${tone}`}>{n}</span>
            <span className="text-caption text-muted">{t.summary[k]}</span>
          </div>
        ))}
      </section>

      {check.newInsurers.length > 0 && (
        <p className="rounded-md bg-primary-soft p-3 text-caption text-primary">{fill(t.newInsurers, { names: check.newInsurers.join(", ") })}</p>
      )}

      {check.problems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading">{t.problemsTitle}</h2>
          <p className="text-caption text-muted">{t.problemsFix}</p>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {check.problems.map((p) => (
              <li key={p.row} className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0">
                <span className="text-body font-medium">
                  {fill(t.row, { n: p.row })}
                  {p.name && <span className="font-normal text-muted"> · {p.name}</span>}
                </span>
                {p.problems.map((k) => (
                  <span key={k} className="text-caption text-danger">
                    {t.problems[k]}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {check.adds.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading">{t.readyTitle}</h2>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {check.adds.map((o) => (
              <li key={o.row} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                <span className="w-14 shrink-0 text-caption text-muted">{fill(t.row, { n: o.row })}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium">{o.name}</span>
                  <span className="text-caption text-muted">{outcome(o)}</span>
                </span>
              </li>
            ))}
          </ul>
          {check.moreAdds > 0 && <p className="text-caption text-muted">{fill(t.moreRows, { n: check.moreAdds })}</p>}
        </section>
      )}

      {nothing && <p className="rounded-lg border border-border bg-surface p-4 text-body text-muted">{t.nothing}</p>}

      <div className="sticky bottom-24 flex flex-col-reverse gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:justify-between md:bottom-4">
        <Button variant="outline" icon="arrow-left" onClick={onBack} disabled={pending}>
          {t.back}
        </Button>
        {!nothing && (
          <Button variant="whatsapp" icon="check" onClick={onImport} disabled={pending} className="whitespace-normal">
            {pending ? t.importing : fill(t.import, { clients: c.newClients, policies: c.newPolicies })}
          </Button>
        )}
      </div>
    </div>
  );
}
