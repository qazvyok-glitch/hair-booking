type ExcelCell = string | number | boolean | Date | null;

function normalizeCell(value: unknown): ExcelCell {
  if (value == null) return "";
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && value && "text" in value) return String((value as { text?: unknown }).text ?? "");
  if (typeof value === "object" && value && "result" in value) return normalizeCell((value as { result?: unknown }).result);
  return String(value);
}

export async function readExcelRows(buffer: ArrayBuffer): Promise<ExcelCell[][]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const rows: ExcelCell[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map(normalizeCell));
  });
  return rows;
}

export async function readExcelObjects(buffer: ArrayBuffer): Promise<Record<string, ExcelCell>[]> {
  const rows = await readExcelRows(buffer);
  const headers = (rows[0] || []).map((value) => String(value ?? "").trim());
  return rows.slice(1).filter((row) => row.some((value) => value !== "")).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

export async function downloadExcelWorkbook(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  sheets.forEach(({ name, rows }) => {
    const worksheet = workbook.addWorksheet(name);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    if (headers.length === 0) return;
    worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(12, header.length * 2 + 4) }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  });
  const data = await workbook.xlsx.writeBuffer();
  const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
