"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportColumn, ExportOptions } from "@/lib/exportToExcel";
import { exportToExcel } from "@/lib/exportToExcel";

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  allData: T[];
  columns: ExportColumn[];
  filename: string;
  options?: ExportOptions;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  allData,
  columns,
  filename,
  options = {},
  disabled = false,
}: ExportButtonProps<T>) {
  const doExport = (rows: T[]) => {
    const mapped = rows.map((row) => row as Record<string, unknown>);
    exportToExcel(mapped, columns, filename, options);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="mr-2 size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => doExport(data)}
          disabled={data.length === 0}
        >
          Export Filtered ({data.length} rows)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => doExport(allData)}
          disabled={allData.length === 0}
        >
          Export All ({allData.length} rows)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
