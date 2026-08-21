import "server-only";

function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * A UTF-8 BOM prefix and \r\n line endings — without both, Excel (the
 * primary consumer for accounting/tax use) misdetects the encoding and
 * mangles anything beyond plain ASCII, and some versions join every row
 * onto one line without the BOM as a hint that this isn't plain text.
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return "﻿" + lines.join("\r\n");
}

export function csvFileResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
