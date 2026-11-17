import "server-only";
import ExcelJS from "exceljs";
import type { Dictionary } from "./i18n";
import type { ExportData } from "./data/export";
import { formatPhone } from "./phone";

// Builds the Excel copy: an About sheet, then one sheet per kind of record.
// Dates are real Excel dates and amounts real numbers, so they sort and sum.

type Lang = "en" | "si";
type Col = { header: string; width: number; kind?: "date" | "money" | "int" };

const toDate = (value: string | null) => {
  if (!value) return null;
  // Date-only values are calendar days; timestamps become the Sri Lanka day.
  const day = value.length > 10 ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date(value)) : value;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

function addSheet(book: ExcelJS.Workbook, name: string, cols: Col[], rows: (string | number | Date | null)[][]) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = cols.map((c) => ({
    header: c.header,
    width: c.width,
    style: c.kind === "date" ? { numFmt: "dd-mm-yyyy" } : c.kind === "money" ? { numFmt: "#,##0.00" } : c.kind === "int" ? { numFmt: "#,##0" } : {},
  }));
  sheet.addRows(rows);
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2346B8" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
}

export async function buildExportWorkbook(data: ExportData, dict: Dictionary, lang: Lang, exportedAt: Date): Promise<Buffer> {
  const t = dict.export;
  const c = t.cols;
  const name = new Map(data.clients.map((cl) => [cl.id, cl.full_name]));
  const clientName = (id: string) => name.get(id) ?? "";
  const rel = (r: string) => (r in dict.family.relationships ? dict.family.relationships[r as keyof typeof dict.family.relationships] : r);

  const book = new ExcelJS.Workbook();
  book.creator = "Client Manager";
  book.created = exportedAt;

  const about = book.addWorksheet(t.about);
  about.columns = [{ width: 22 }, { width: 70 }];
  about.addRows([
    [t.exportedOn, new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(exportedAt)],
    [t.source, "Client Manager"],
    ["", t.warningShort],
    ["", t.filesNote],
    [],
    ...(["clients", "policies", "payments", "family", "followUps", "notes", "documents", "insurers"] as const).map((k) => [
      t.sheets[k],
      { clients: data.clients, policies: data.policies, payments: data.payments, family: data.family, followUps: data.followUps, notes: data.notes, documents: data.documents, insurers: data.insurers }[k].length,
    ]),
  ]);
  about.getColumn(1).font = { bold: true };
  about.getCell("B3").font = { bold: true, color: { argb: "FFB91C1C" } };

  addSheet(
    book,
    t.sheets.clients,
    [
      { header: c.name, width: 26 },
      { header: c.mobile, width: 15 },
      { header: c.whatsapp, width: 16 },
      { header: c.nic, width: 15 },
      { header: c.dob, width: 13, kind: "date" },
      { header: c.address, width: 34 },
      { header: c.language, width: 10 },
      { header: c.added, width: 13, kind: "date" },
    ],
    data.clients.map((cl) => [
      cl.full_name,
      formatPhone(cl.mobile),
      cl.whatsapp ? formatPhone(cl.whatsapp) : t.sameAsMobile,
      cl.nic,
      toDate(cl.date_of_birth),
      cl.address,
      cl.preferred_language === "si" ? "සිංහල" : "English",
      toDate(cl.created_at),
    ]),
  );

  addSheet(
    book,
    t.sheets.policies,
    [
      { header: c.client, width: 24 },
      { header: c.insurer, width: 26 },
      { header: c.type, width: 11 },
      { header: c.number, width: 16 },
      { header: c.sumAssured, width: 15, kind: "money" },
      { header: c.premium, width: 12, kind: "money" },
      { header: c.pays, width: 16 },
      { header: c.start, width: 12, kind: "date" },
      { header: c.nextDue, width: 12, kind: "date" },
      { header: c.renewal, width: 12, kind: "date" },
      { header: c.status, width: 12 },
    ],
    data.policies.map((p) => [
      clientName(p.client_id),
      p.insurer?.name ?? "",
      dict.policyTypes[p.type],
      p.policy_number,
      p.sum_assured,
      p.premium,
      dict.policyForm.frequencies[p.frequency],
      toDate(p.start_date),
      toDate(p.next_due_date),
      toDate(p.renewal_date),
      dict.policy.status[p.status],
    ]),
  );

  addSheet(
    book,
    t.sheets.payments,
    [
      { header: c.client, width: 24 },
      { header: c.number, width: 16 },
      { header: c.insurer, width: 26 },
      { header: c.type, width: 11 },
      { header: c.forDue, width: 14, kind: "date" },
      { header: c.paidOn, width: 12, kind: "date" },
      { header: c.amount, width: 12, kind: "money" },
      { header: c.method, width: 14 },
    ],
    data.payments.map((p) => [
      clientName(p.client_id),
      p.policy?.policy_number ?? "",
      p.policy?.insurer?.name ?? "",
      p.policy ? dict.policyTypes[p.policy.type] : "",
      toDate(p.due_date),
      toDate(p.paid_on),
      Number(p.amount),
      dict.payments.methods[p.method],
    ]),
  );

  addSheet(
    book,
    t.sheets.family,
    [
      { header: c.client, width: 24 },
      { header: c.name, width: 24 },
      { header: c.relationship, width: 14 },
      { header: c.dob, width: 13, kind: "date" },
    ],
    data.family.map((f) => [clientName(f.client_id), f.full_name, rel(f.relationship), toDate(f.date_of_birth)]),
  );

  addSheet(
    book,
    t.sheets.followUps,
    [
      { header: c.client, width: 24 },
      { header: c.due, width: 12, kind: "date" },
      { header: c.note, width: 60 },
      { header: c.doneOn, width: 13, kind: "date" },
    ],
    data.followUps.map((f) => [clientName(f.client_id), toDate(f.due_date), f.note, toDate(f.done_at)]),
  );

  addSheet(
    book,
    t.sheets.notes,
    [
      { header: c.client, width: 24 },
      { header: c.date, width: 12, kind: "date" },
      { header: c.note, width: 80 },
    ],
    data.notes.map((n) => [clientName(n.client_id), toDate(n.created_at), n.body]),
  );

  addSheet(
    book,
    t.sheets.documents,
    [
      { header: c.client, width: 24 },
      { header: c.name, width: 28 },
      { header: c.type, width: 20 },
      { header: c.fileType, width: 12 },
      { header: c.sizeKb, width: 11, kind: "int" },
      { header: c.added, width: 13, kind: "date" },
    ],
    data.documents.map((d) => [
      clientName(d.client_id),
      d.title,
      dict.documents.labels[d.label],
      d.mime_type === "application/pdf" ? "PDF" : "Photo",
      Math.round(d.size_bytes / 1024),
      toDate(d.created_at),
    ]),
  );

  addSheet(
    book,
    t.sheets.insurers,
    [
      { header: c.name, width: 30 },
      { header: c.branch, width: 20 },
      { header: c.phone, width: 16 },
    ],
    data.insurers.map((i) => [i.name, i.branch, i.phone]),
  );

  return Buffer.from(await book.xlsx.writeBuffer());
}
