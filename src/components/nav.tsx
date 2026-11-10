"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import type { Locale } from "@/lib/locales";

export type NavLabels = { today: string; clients: string; reminders: string; documents: string };

const items: { key: keyof NavLabels; href: string; icon: IconName }[] = [
  { key: "today", href: "", icon: "home" },
  { key: "clients", href: "/clients", icon: "users" },
  { key: "reminders", href: "/reminders", icon: "bell" },
  { key: "documents", href: "/documents", icon: "folder" },
];

function useActive(lang: Locale) {
  const pathname = usePathname();
  return (href: string) =>
    href === "" ? pathname === `/${lang}` : pathname.startsWith(`/${lang}${href}`);
}

/** Phone: fixed bar at the bottom (Figma "Bottom nav"). Hidden from tablet width up. */
export function BottomNav({ lang, labels }: { lang: Locale; labels: NavLabels }) {
  const isActive = useActive(lang);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-2 pt-1 pb-[max(20px,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={`/${lang}${item.href}`}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2 text-label font-medium ${active ? "text-primary" : "text-muted"}`}
              >
                <span className={`rounded-full px-4 py-1 ${active ? "bg-primary-soft" : ""}`}>
                  <Icon name={item.icon} />
                </span>
                <span className="max-w-full truncate">{labels[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablet and laptop: sidebar on the left (Figma "Sidebar"). */
export function SidebarNav({ lang, labels }: { lang: Locale; labels: NavLabels }) {
  const isActive = useActive(lang);
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.key}>
            <Link
              href={`/${lang}${item.href}`}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-md px-3 text-body ${
                active ? "bg-primary-soft font-medium text-primary" : "text-text hover:bg-bg"
              }`}
            >
              <Icon name={item.icon} className={active ? "text-primary" : "text-muted"} />
              {labels[item.key]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
