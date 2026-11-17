import { requireUser } from "@/lib/auth";
import { dictionaryFor } from "@/lib/i18n";
import { hasLocale } from "@/lib/locales";
import { loadExportData } from "@/lib/data/export";
import { buildExportWorkbook } from "@/lib/export-workbook";
import { colomboToday } from "@/lib/format";

// Downloads the agent's own data as an Excel file. Never cached.

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  try {
    await requireUser();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const { lang } = await params;
  if (!hasLocale(lang)) return new Response("Not found", { status: 404 });
  const dict = await dictionaryFor(lang);
  const file = await buildExportWorkbook(await loadExportData(), dict, lang, new Date());

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="client-manager-${colomboToday()}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
