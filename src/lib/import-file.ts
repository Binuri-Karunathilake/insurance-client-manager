import "server-only";
import ExcelJS from "exceljs";
import { guessMapping, isBlank, MAX_ROWS } from "./import";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** rowNumbers[i] is the spreadsheet row number of rows[i], for messages like "Row 12". */
export type Sheet = { headers: string[]; rows: string[][]; rowNumbers: number[] };
export type ReadError = "tooBig" | "unreadable" | "empty" | "tooMany";

/** Cell text the import rules understand: dates as YYYY-MM-DD, numbers as plain digits. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if ("richText" in value) return value.richText.map((r) => r.text).join("");
  if ("result" in value) return cellText((value.result ?? null) as ExcelJS.CellValue);
  if ("text" in value) return String(value.text);
  return "";
}

/** A small CSV reader: quoted cells, "" inside quotes, comma / semicolon / tab. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

/**
 * The heading row is the first of the top 10 rows with at least two headings
 * the app recognises (some files have a title above it); otherwise the first
 * row with anything in it.
 */
function toSheet(grid: string[][]): Sheet & { score: number } {
  const top = grid.slice(0, 10);
  let at = top.findIndex((r) => Object.keys(guessMapping(r)).length >= 2);
  if (at < 0) at = grid.findIndex((r) => !isBlank(r));
  if (at < 0) return { headers: [], rows: [], rowNumbers: [], score: 0 };
  const headers = grid[at].map((h) => h.trim());
  const width = Math.max(headers.length, ...grid.slice(at + 1).map((r) => r.length));
  while (headers.length < width) headers.push("");
  const kept = grid
    .map((r, i) => ({ r, n: i + 1 }))
    .slice(at + 1)
    .filter(({ r }) => !isBlank(r));
  const rows = kept.map(({ r }) => headers.map((_, i) => (r[i] ?? "").trim()));
  const rowNumbers = kept.map(({ n }) => n);
  const mapping = guessMapping(headers);
  // A sheet with both name and mobile columns beats one that merely has more headings.
  const score = Object.keys(mapping).length + (mapping.full_name !== undefined && mapping.mobile !== undefined ? 100 : 0);
  return { headers, rows, rowNumbers, score };
}

export async function readSpreadsheet(file: File): Promise<Sheet | { error: ReadError }> {
  if (file.size > MAX_FILE_BYTES) return { error: "tooBig" };
  const bytes = Buffer.from(await file.arrayBuffer());
  let sheets: (Sheet & { score: number })[];

  try {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      // .xlsx is a zip file ("PK")
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes as unknown as ArrayBuffer);
      sheets = book.worksheets.map((ws) => {
        const grid: string[][] = [];
        ws.eachRow({ includeEmpty: true }, (row, n) => {
          const values = row.values as ExcelJS.CellValue[]; // 1-based
          grid[n - 1] = values.slice(1).map(cellText);
        });
        return toSheet(Array.from(grid, (r) => r ?? []));
      });
    } else if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
      return { error: "unreadable" }; // old .xls: ask for .xlsx
    } else {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        text = new TextDecoder("windows-1252").decode(bytes); // Excel's plain "CSV" on Windows
      }
      sheets = [toSheet(parseCsv(text))];
    }
  } catch {
    return { error: "unreadable" };
  }

  // The sheet whose headings the app recognises best (skips "How to fill in").
  const best = sheets.filter((s) => s.rows.length).sort((a, b) => b.score - a.score)[0];
  if (!best) return { error: "empty" };
  if (best.rows.length > MAX_ROWS) return { error: "tooMany" };
  return { headers: best.headers, rows: best.rows, rowNumbers: best.rowNumbers };
}
