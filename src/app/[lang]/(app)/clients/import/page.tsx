import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href={`/${lang}/clients`} className="-ml-1 flex w-fit items-center gap-2 rounded-md px-1 py-1 text-body text-muted hover:text-text">
        <Icon name="arrow-left" size={20} />
        {dict.nav.clients}
      </Link>
      <h1 className="text-title">{dict.import.title}</h1>
      <ImportWizard t={dict.import} lang={lang} />
    </div>
  );
}
