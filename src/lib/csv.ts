/** Quotes every cell, and defuses spreadsheet formulas: a user-controlled
 * value starting with = + - @ would otherwise execute when the file is
 * opened in Excel/Sheets. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number)[][]): string {
  return `${rows.map((cells) => cells.map((cell) => csvCell(String(cell))).join(",")).join("\r\n")}\r\n`;
}

/** A download response for an admin "Export" button. */
export function csvResponse(filenameStem: string, rows: (string | number)[][]): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameStem}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
