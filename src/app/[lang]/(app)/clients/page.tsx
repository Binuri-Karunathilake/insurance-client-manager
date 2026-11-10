import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { ComingNext } from "@/components/coming-next";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const dict = await getDictionary();
  return (
    <ComingNext
      icon="users"
      title={dict.nav.clients}
      body={dict.placeholder.clients}
      note={dict.placeholder.comingNext}
    />
  );
}
