"use client";

/**
 * VinScanButton — a pair of small icon buttons that open barcode or OCR scanners.
 *
 * Barcode button  → ScannerDialog (html5-qrcode, scanType="vin")
 *   Use when the VIN is printed as a Code 128/39 barcode (most new vehicles, service labels).
 *
 * OCR Photo button → OcrScannerDialog (Tesseract.js)
 *   Use when the VIN is etched, stamped, or printed as plain text
 *   (dashboard sticker, chassis plate, document photo).
 *
 * Drop-in beside any VIN <Input> instead of wiring each dialog separately.
 *
 * @example
 * <div className="flex gap-2">
 *   <Input value={vin} onChange={(e) => setVin(e.target.value)} />
 *   <VinScanButton onScan={setVin} />
 * </div>
 */

import { useState } from "react";
import { ScanLine, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { OcrScannerDialog } from "@/components/scanner/OcrScannerDialog";

export interface VinScanButtonProps {
  onScan: (vin: string) => void;
  /** Extra class names applied to the wrapper div. */
  className?: string;
  /** Tooltip / aria-label prefix. Defaults to "VIN". */
  label?: string;
  size?: "default" | "sm" | "icon";
}

export function VinScanButton({
  onScan,
  className,
  label = "VIN",
  size = "icon",
}: VinScanButtonProps) {
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  return (
    <>
      <div className={`flex shrink-0 items-center gap-1 ${className ?? ""}`}>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => setBarcodeOpen(true)}
          title={`Scan ${label} barcode`}
          aria-label={`Scan ${label} barcode`}
        >
          <ScanLine className="size-4" />
          {size !== "icon" && <span className="ml-1 hidden sm:inline">Barcode</span>}
        </Button>

        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => setOcrOpen(true)}
          title={`Scan ${label} via photo (OCR)`}
          aria-label={`Scan ${label} via photo (OCR)`}
        >
          <ScanText className="size-4" />
          {size !== "icon" && <span className="ml-1 hidden sm:inline">OCR</span>}
        </Button>
      </div>

      <ScannerDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        onScan={onScan}
        scanType="vin"
        title="Scan VIN barcode"
        placeholder="17-character VIN..."
      />

      <OcrScannerDialog
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onScan={onScan}
        title="Scan VIN (photo)"
        placeholder="17-character VIN..."
      />
    </>
  );
}
