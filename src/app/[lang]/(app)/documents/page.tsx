import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { ComingNext } from "@/components/coming-next";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const dict = await getDictionary();
  return (
    <ComingNext
      icon="folder"
      title={dict.nav.documents}
      body={dict.placeholder.documents}
      note={dict.placeholder.comingNext}
    />
  );
}
