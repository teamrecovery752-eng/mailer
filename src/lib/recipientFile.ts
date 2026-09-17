import Papa from "papaparse";
import * as XLSX from "xlsx";

// Spreadsheet file extensions accepted by any recipient uploader.
export const SPREADSHEET_ACCEPT = ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods";
const DELIMITED_EXTENSIONS = new Set(["csv", "tsv", "txt"]);

// Case-insensitive, whitespace/BOM-tolerant column name match. Handles
// "Email", " EMAIL ", a BOM-prefixed first header, etc.
const normalizeHeader = (s: string) => String(s).replace(/^\uFEFF/, "").trim().toLowerCase();

// Given raw parsed rows (from either CSV/TSV via PapaParse or a sheet via
// SheetJS), find the "email" and "name" columns regardless of their exact
// capitalisation, surrounding whitespace, or position/number of columns in
// the file, and copy their values onto canonical lowercase `email` / `name`
// keys the rest of the app expects — without dropping the original column
// (so a template using the original header as a merge tag still works).
export function normalizeRecipientRows(rawRows: Record<string, any>[]) {
  if (!rawRows.length) return { data: [] as any[], columns: [] as string[], emailCol: null as string | null };

  const rawCols = Object.keys(rawRows[0]);
  const emailCol = rawCols.find((c) => normalizeHeader(c) === "email") || null;
  const nameCol = rawCols.find((c) => normalizeHeader(c) === "name") || null;

  const data = rawRows.map((row) => {
    const next: Record<string, any> = { ...row };
    if (emailCol) next.email = typeof row[emailCol] === "string" ? row[emailCol].trim() : row[emailCol];
    if (nameCol) next.name = typeof row[nameCol] === "string" ? row[nameCol].trim() : row[nameCol];
    return next;
  });

  let columns = rawCols;
  if (emailCol && !columns.includes("email")) columns = [...columns, "email"];
  if (nameCol && !columns.includes("name")) columns = [...columns, "name"];

  return { data, columns, emailCol };
}

// Parses a CSV/TSV/plain-text or Excel/ODS file into normalized recipient
// rows. Rejects with a short, user-facing message on any read/parse
// failure rather than throwing a raw library error.
export function parseRecipientFile(file: File): Promise<{ data: any[]; columns: string[]; emailCol: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (DELIMITED_EXTENSIONS.has(ext)) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rawRows = res.data as Record<string, any>[];
          if (!rawRows.length) return reject(new Error("That file doesn't seem to contain any rows."));
          resolve(normalizeRecipientRows(rawRows));
        },
        error: () => reject(new Error("The CSV/TSV file appears to be corrupted.")),
      });
    });
  }

  // Everything else (.xlsx, .xls, .xlsm, .ods) — parse with SheetJS,
  // reading only the first worksheet.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("No sheets found");
        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, any>[];
        if (!rawRows.length) return reject(new Error("That file doesn't seem to contain any rows."));
        resolve(normalizeRecipientRows(rawRows));
      } catch {
        reject(new Error("Make sure it's a valid Excel/ODS file and try again."));
      }
    };
    reader.onerror = () => reject(new Error("There was a problem reading the file."));
    reader.readAsArrayBuffer(file);
  });
}
