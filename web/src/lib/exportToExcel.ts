import * as XLSX from "xlsx-js-style";

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  type?: "text" | "number" | "date" | "currency" | "priority";
}

const HEADER_STYLE = {
  font: { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { fgColor: { rgb: "FF111827" } },
  alignment: { horizontal: "left" as const },
};

const BORDER = {
  top: { style: "thin" as const, color: { rgb: "FFE5E7EB" } },
  bottom: { style: "thin" as const, color: { rgb: "FFE5E7EB" } },
  left: { style: "thin" as const, color: { rgb: "FFE5E7EB" } },
  right: { style: "thin" as const, color: { rgb: "FFE5E7EB" } },
};

const STATUS_BG: Record<string, string> = {
  available: "FFF0FDF4",
  sold: "FFEFF6FF",
  completed: "FFEFF6FF",
  approved: "FFEFF6FF",
  delivered: "FFEFF6FF",
  inbound: "FFFFFBEB",
  inventory: "FFFFFBEB",
  in_stock: "FFF0FDF4",
  showroom: "FFEFF6FF",
  pending: "FFFFFBEB",
  reserved: "FFFFFBEB",
  in_progress: "FFFFFBEB",
  awaiting_approval: "FFFFFBEB",
  submitted: "FFFFFBEB",
  urgent: "FFFEF2F2",
  overdue: "FFFEF2F2",
  rejected: "FFFEF2F2",
  done: "FFEFF6FF",
};

function getStatusBg(value: string): string | undefined {
  const lower = String(value || "").toLowerCase().replace(/\s/g, "_");
  return STATUS_BG[lower] ?? STATUS_BG[value.toLowerCase()];
}

/**
 * Returns a real Date object so xlsx-js-style serializes it as an Excel
 * date serial (sortable, filterable, usable in pivot tables). Previously
 * we returned "DD/MM/YYYY" strings which Excel sorted alphabetically.
 */
function formatDate(val: string | null | undefined): Date | "" {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d;
}

/**
 * Returns a number so Excel can SUM / AVG / chart the column. Previously
 * returned "USD 10000" as a string, which made every export financially
 * useless. The currency code goes in the column header instead.
 */
function formatCurrency(val: number | null | undefined): number | "" {
  if (val == null || isNaN(val)) return "";
  return Number(val);
}

export interface ExportOptions {
  pageName?: string;
  summary?: string;
  includeTitleRow?: boolean;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  options: ExportOptions = {}
) {
  const { pageName, summary, includeTitleRow = true } = options;

  const rows = data.map((row) =>
    Object.fromEntries(
      columns.map((col) => {
        let val = row[col.key];
        if (col.type === "date") val = formatDate(val as string);
        if (col.type === "currency") val = formatCurrency(val as number);
        return [col.header, val ?? ""];
      })
    )
  );

  const aoa: (string | number | Date | "")[][] = [];
  if (includeTitleRow && pageName) {
    aoa.push([`Monza App — ${pageName} Export`]);
  }
  aoa.push(columns.map((c) => c.header));
  rows.forEach((r) =>
    aoa.push(
      columns.map((c) => {
        const v = r[c.header];
        // Allow numbers, dates, and strings through unchanged so Excel
        // serializes them with the right type.
        if (v instanceof Date) return v;
        if (typeof v === "number") return v;
        return (v as string) ?? "";
      })
    )
  );
  if (summary) {
    aoa.push([summary, ...Array(columns.length - 1).fill("")]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = columns.map((col) => {
    if (col.key === "vin") return { wch: 22 };
    if (col.header.toLowerCase().includes("phone")) return { wch: 18 };
    if (col.type === "date") return { wch: 14 };
    return { wch: Math.min(50, Math.max(12, (col.width ?? col.header.length) + 4)) };
  });
  ws["!cols"] = colWidths;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const headerRow = includeTitleRow && pageName ? 1 : 0;
  const dataStartRow = headerRow + 1;

  if (includeTitleRow && pageName) {
    const titleCell = ws["A1"];
    if (titleCell) {
      titleCell.s = {
        font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FF111827" } },
        fill: { fgColor: { rgb: "FFF59E0B" } },
        alignment: { horizontal: "left" as const },
      };
    }
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  }

  for (let C = 0; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: C });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = { ...HEADER_STYLE, border: BORDER };
    }
  }

  for (let R = dataStartRow; R <= range.e.r; R++) {
    const isSummary = summary && R === range.e.r;
    for (let C = 0; C <= range.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (!cell) continue;

      const col = columns[C];
      const isOdd = (R - dataStartRow) % 2 === 0;
      const bg = isSummary ? "FFFEF3C7" : isOdd ? "FFFFFFFF" : "FFF3F4F6";

      let align: "left" | "right" | "center" = "left";
      if (col?.type === "number" || col?.type === "currency") align = "right";
      if (col?.type === "date") align = "center";

      const statusBg = col && (col.key === "status" || col.key === "priority" || col.key === "lead_status")
        ? getStatusBg(String(cell.v ?? ""))
        : null;

      cell.s = {
        font: { name: "Arial", sz: 11, bold: isSummary },
        fill: { fgColor: { rgb: statusBg && !isSummary ? statusBg : bg } },
        alignment: { horizontal: align, wrapText: true },
        border: BORDER,
        ...(col?.type === "date"
          ? { numFmt: "dd/mm/yyyy" }
          : col?.type === "currency"
            ? { numFmt: "#,##0" }
            : col?.type === "number"
              ? { numFmt: "#,##0.##" }
              : {}),
      };
      // Tell Excel the cell value is a date so it serializes as a date serial.
      if (col?.type === "date" && cell.v instanceof Date) {
        cell.t = "d";
      } else if ((col?.type === "currency" || col?.type === "number") && typeof cell.v === "number") {
        cell.t = "n";
      }
    }
  }

  ws["!freeze"] = { xSplit: 0, ySplit: dataStartRow };
  ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  // Include time as well as date so multiple exports per day don't overwrite
  // each other in the user's Downloads folder.
  const tsStr = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  XLSX.writeFile(wb, `${filename}_${tsStr}.xlsx`);
}
