import "server-only";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./locales";

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  si: () => import("./dictionaries/si.json").then((m) => m.default),
} satisfies Record<Locale, unknown>;

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

/** The locale of the current route (/en/... or /si/...). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

/** The dictionary for the current route's locale. */
export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
