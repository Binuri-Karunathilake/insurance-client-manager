import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { ComingNext } from "@/components/coming-next";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const dict = await getDictionary();
  return (
    <ComingNext
      icon="bell"
      title={dict.nav.reminders}
      body={dict.placeholder.reminders}
      note={dict.placeholder.comingNext}
    />
  );
}
