import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { dictionaryFor } from "@/lib/i18n";
import { hasLocale } from "@/lib/locales";
import { FIELDS, type FieldKey } from "@/lib/import";

// The import template: the headings the importer recognises, in the app's
// language, with made-up example rows and a sheet of tips.

const WIDTHS: Partial<Record<FieldKey, number>> = { full_name: 24, address: 28, insurer: 26, policy_number: 16, date_of_birth: 14, start_date: 13, next_due_date: 13, renewal_date: 13 };
const DATES: FieldKey[] = ["date_of_birth", "start_date", "next_due_date", "renewal_date"];

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  try {
    await requireUser();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const { lang } = await params;
  if (!hasLocale(lang)) return new Response("Not found", { status: 404 });
  const dict = await dictionaryFor(lang);
  const t = dict.import;

  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  // Made-up people, never real clients.
  const examples: Partial<Record<FieldKey, string | number | Date>>[] = [
    { full_name: "Saman Kumara", mobile: "077 000 1234", nic: "850000123V", date_of_birth: d("1985-04-12"), address: "10 Example Road, Kandy", insurer: "Example Life", type: dict.policyTypes.life, policy_number: "EX-1001", sum_assured: 1000000, premium: 4500, frequency: dict.policyForm.frequencies.monthly, start_date: d("2023-02-05") },
    { full_name: "Saman Kumara", mobile: "077 000 1234", nic: "850000123V", insurer: "Example General", type: dict.policyTypes.motor, policy_number: "EX-M-2002", premium: 32000, frequency: dict.policyForm.frequencies.yearly, start_date: d("2024-06-20") },
    { full_name: "Anoma Dissanayake", mobile: "071 000 5678", date_of_birth: d("1990-09-30") },
  ];

  const book = new ExcelJS.Workbook();
  book.creator = "Client Manager";
  const sheet = book.addWorksheet(t.templateSheet, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = FIELDS.map((f) => ({
    header: t.fields[f],
    key: f,
    width: WIDTHS[f] ?? 14,
    style: DATES.includes(f) ? { numFmt: "dd/mm/yyyy" } : f === "premium" || f === "sum_assured" ? { numFmt: "#,##0" } : {},
  }));
  sheet.addRows(examples);
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFC" } };
  for (const f of ["full_name", "mobile"] as const) sheet.getCell(1, FIELDS.indexOf(f) + 1).font = { bold: true, color: { argb: "FF1E40AF" } };
  // NIC and phone numbers as text, so Excel keeps leading zeros.
  for (const f of ["mobile", "whatsapp", "nic", "policy_number"] as const) sheet.getColumn(FIELDS.indexOf(f) + 1).numFmt = "@";

  const help = book.addWorksheet(t.templateHelp);
  help.columns = [{ width: 100 }];
  help.addRows(t.templateTips.map((tip) => [tip]));

  const file = Buffer.from(await book.xlsx.writeBuffer());
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="client-manager-import-template.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
