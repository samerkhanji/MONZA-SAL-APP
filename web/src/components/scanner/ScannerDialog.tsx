"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Flashlight, ScanLine } from "lucide-react";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

function isValidVin(value: string): boolean {
  return VIN_REGEX.test(value.toUpperCase());
}

export interface ScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
  placeholder?: string;
  scanType?: "vin" | "part" | "any";
}

export function ScannerDialog({
  open,
  onClose,
  onScan,
  title = "Scan Barcode",
  placeholder = "VIN or part number...",
  scanType = "any",
}: ScannerDialogProps) {
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const isRunningRef = useRef(false);
  const containerId = "scanner-container";

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    isRunningRef.current = false;

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        const formats =
          scanType === "vin"
            ? [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.QR_CODE,
              ]
            : scanType === "part"
              ? [
                  Html5QrcodeSupportedFormats.CODE_128,
                  Html5QrcodeSupportedFormats.CODE_39,
                  Html5QrcodeSupportedFormats.QR_CODE,
                ]
              : undefined;

        const html5QrCode = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: formats ?? [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });
        scannerRef.current = html5QrCode;

        const cameras = await Html5Qrcode.getCameras();
        const backCamera = cameras.find(
          (c) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("environment") ||
            c.label.toLowerCase().includes("rear")
        );
        const cameraId = backCamera?.id ?? cameras[0]?.id;

        if (!cameraId) {
          setCameraError("No camera found");
          return;
        }

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (!mounted) return;
            const value = decodedText.trim();
            if (scanType === "vin" && !isValidVin(value)) {
              return;
            }
            if (navigator.vibrate) navigator.vibrate(200);
            onScan(value);
            onClose();
          },
          () => {}
        );
        if (mounted) isRunningRef.current = true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Camera unavailable";
        setCameraError(msg);
        if (
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("denied")
        ) {
          toast.error("Camera permission denied. Use manual entry below.");
        } else {
          toast.error("Camera unavailable. Use manual entry below.");
        }
      }
    };

    startScanner();
    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner && isRunningRef.current) {
        Promise.resolve()
          .then(() => scanner.stop())
          .catch(() => {})
          .finally(() => {});
      }
    };
  }, [open, scanType, onScan, onClose]);

  async function toggleFlash() {
    if (!scannerRef.current) return;
    const next = !flashOn;
    try {
      const scanner = scannerRef.current as {
        applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
      };
      await scanner.applyVideoConstraints?.(
        { advanced: [{ torch: next }] } as unknown as MediaTrackConstraints
      );
      setFlashOn(next);
    } catch {
      toast.error("Flash not supported on this device");
    }
  }

  function handleManualSubmit() {
    const value = manualValue.trim().toUpperCase();
    if (!value) {
      toast.error("Enter a value");
      return;
    }
    if (scanType === "vin" && !isValidVin(value)) {
      toast.error("Invalid VIN. Must be 17 characters (no I, O, Q).");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(200);
    onScan(value);
    setManualValue("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-[500px] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="relative w-full overflow-hidden rounded-lg bg-black">
            <div
              id={containerId}
              className="min-h-[240px] w-full sm:min-h-[280px]"
              style={{ minHeight: 280 }}
            />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/95">
                <p className="text-center text-sm text-slate-300">
                  {cameraError}
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2"
              onClick={toggleFlash}
              title={flashOn ? "Flash off" : "Flash on"}
            >
              <Flashlight
                className={`size-5 ${flashOn ? "fill-current" : ""}`}
              />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Or enter manually</Label>
            <div className="flex gap-2">
              <Input
                placeholder={placeholder}
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                className="flex-1"
              />
              <Button onClick={handleManualSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
