import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label font-medium text-muted">{label}</span>
      <input
        {...input}
        className="h-12 rounded-sm border border-border bg-surface px-3 text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
      />
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
