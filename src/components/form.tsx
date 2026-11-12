import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Icon } from "./icons";

const control =
  "w-full rounded-sm border border-border bg-surface px-3 text-body outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-soft aria-invalid:border-danger";

function Label({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-label font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-caption text-danger">{error}</span>
      ) : (
        hint && <span className="text-caption text-muted">{hint}</span>
      )}
    </label>
  );
}

type Extra = { label: string; hint?: string; error?: string };

export function Field({ label, hint, error, ...input }: Extra & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} hint={hint} error={error}>
      <input {...input} aria-invalid={error ? true : undefined} className={`h-12 ${control}`} />
    </Label>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: Extra & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label label={label} hint={hint} error={error}>
      <span className="relative">
        <select {...select} aria-invalid={error ? true : undefined} className={`h-12 appearance-none pr-10 ${control}`}>
          {children}
        </select>
        <Icon name="chevron-down" size={20} className="pointer-events-none absolute top-3.5 right-3 text-muted" />
      </span>
    </Label>
  );
}

export function TextArea({ label, hint, error, ...area }: Extra & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label label={label} hint={hint} error={error}>
      <textarea {...area} aria-invalid={error ? true : undefined} className={`min-h-24 py-3 ${control}`} />
    </Label>
  );
}

export function Checkbox({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3 text-body">
      <input type="checkbox" {...input} className="size-5 shrink-0 rounded-[6px] accent-primary" />
      {label}
    </label>
  );
}

export function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="h-12 rounded-md bg-primary px-4 text-body font-medium text-on-primary disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-caption text-danger">
      {children}
    </p>
  );
}

export function SuccessText({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-sm bg-success-soft px-3 py-2 text-caption text-success">
      {children}
    </p>
  );
}

export function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field
      label={label}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      style={{ letterSpacing: "0.3em" }}
    />
  );
}
