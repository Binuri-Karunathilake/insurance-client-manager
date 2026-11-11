import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Figma "Button" component: Primary, Secondary, WhatsApp, Outline.
export type ButtonStyle = "primary" | "secondary" | "whatsapp" | "outline" | "danger";

const styles: Record<ButtonStyle, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90",
  secondary: "bg-primary-soft text-primary hover:bg-primary-soft/70",
  whatsapp: "bg-success text-on-primary hover:bg-success/90",
  outline: "border border-border bg-surface text-text hover:bg-bg",
  danger: "border border-border bg-surface text-danger hover:bg-danger-soft",
};

function classes(style: ButtonStyle, size: "md" | "sm", className = "") {
  const height = size === "sm" ? "h-9 px-3 text-caption" : "h-11 px-4 text-body";
  return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-60 ${height} ${styles[style]} ${className}`;
}

type Common = { variant?: ButtonStyle; size?: "md" | "sm"; icon?: IconName; children?: ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  type = "button",
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
    </Link>
  );
}

/** Plain <a> for tel: and WhatsApp links, which leave the app. */
export function ButtonAnchor({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  ...props
}: Common & ComponentProps<"a">) {
  return (
    <a className={classes(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
    </a>
  );
}
