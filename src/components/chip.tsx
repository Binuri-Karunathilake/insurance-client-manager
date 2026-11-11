import type { ReactNode } from "react";

// Figma "Chip" component tones.
export type Tone = "warning" | "danger" | "success" | "primary" | "neutral";

const tones: Record<Tone, string> = {
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-bg text-muted",
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-label font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary ${size >= 56 ? "text-heading" : "text-body"}`}
    >
      {initials}
    </span>
  );
}
