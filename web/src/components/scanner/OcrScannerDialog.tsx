"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, RefreshCw, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;

/**
 * Normalises OCR output before VIN extraction.
 * Common mis-reads: O→0, I→1, Q→0.
 */
function extractVins(rawText: string): string[] {
  const normalised = rawText
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/\bI\b/g, "1")
    .replace(/Q/g, "0")
    .replace(/[^A-HJ-NPR-Z0-9]/g, " ");
  const matches = normalised.match(VIN_PATTERN);
  return [...new Set(matches ?? [])];
}

export interface OcrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen / entered VIN (17-char, uppercase). */
  onScan: (value: string) => void;
  title?: string;
  placeholder?: string;
}

type Phase = "capture" | "processing" | "results";

/**
 * OCR-based VIN scanner.
 *
 * Opens the rear camera, lets the user frame the VIN plate / sticker, captures a
 * still frame and runs Tesseract.js OCR to extract 17-character VIN strings.
 * Useful when the VIN is etched or printed as plain text (no barcode available).
 *
 * Falls back to manual entry if OCR finds nothing or the camera is unavailable.
 */
export function OcrScannerDialog({
  open,
  onClose,
  onScan,
  title = "Scan VIN (photo)",
  placeholder = "VIN...",
}: OcrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(
        msg.toLowerCase().includes("permission")
          ? "Camera permission denied. Use manual entry below."
          : "Camera unavailable. Use manual entry below."
      );
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setPhase("capture");
      setCandidates([]);
      setCapturedDataUrl(null);
      setManualValue("");
      setCameraError(null);
      return;
    }
    void startStream();
    return stopStream;
  }, [open, startStream, stopStream]);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    setCapturedDataUrl(dataUrl);
    setPhase("processing");
    stopStream();

    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data: { text } } = await Tesseract.recognize(dataUrl, "eng");
      const found = extractVins(text);
      setCandidates(found);
      if (found.length === 0) {
        toast.warning("No VIN found. Try again with better light or a closer shot.");
      }
    } catch {
      toast.error("OCR failed. Try again or use manual entry.");
    } finally {
      setPhase("results");
    }
  }

  function handleSelect(vin: string) {
    if (navigator.vibrate) navigator.vibrate(200);
    onScan(vin);
    onClose();
  }

  function handleManualSubmit() {
    const value = manualValue.trim().toUpperCase();
    if (!value) {
      toast.error("Enter a VIN");
      return;
    }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) {
      toast.error("Invalid VIN — must be 17 characters (no I, O, Q).");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(200);
    onScan(value);
    setManualValue("");
    onClose();
  }

  function retry() {
    setCandidates([]);
    setCapturedDataUrl(null);
    setPhase("capture");
    void startStream();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopStream(); onClose(); } }}>
      <DialogContent className="max-h-[95vh] max-w-[500px] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="size-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Camera / captured image */}
          <div
            className="relative w-full overflow-hidden rounded-lg bg-black"
            style={{ minHeight: 200 }}
          >
            {phase === "capture" &&
              (cameraError ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <p className="px-4 text-center text-sm text-slate-300">{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                  style={{ minHeight: 200 }}
                />
              ))}

            {phase === "processing" && capturedDataUrl && (
              <div className="relative">
                <img src={capturedDataUrl} alt="Captured" className="w-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                  <RefreshCw className="size-8 animate-spin text-white" />
                  <p className="mt-2 text-sm font-medium text-white">Reading VIN…</p>
                </div>
              </div>
            )}

            {phase === "results" && capturedDataUrl && (
              <img src={capturedDataUrl} alt="Captured" className="w-full opacity-40" />
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Capture button */}
          {phase === "capture" && !cameraError && (
            <Button className="w-full" onClick={() => void capture()}>
              <Camera className="mr-2 size-4" />
              Capture &amp; Read VIN
            </Button>
          )}

          {/* OCR results */}
          {phase === "results" && (
            <div className="space-y-2">
              {candidates.length > 0 ? (
                <>
                  <p className="text-sm font-medium">
                    {candidates.length === 1
                      ? "VIN found — tap to use:"
                      : `${candidates.length} VINs found — tap to use:`}
                  </p>
                  {candidates.map((vin) => (
                    <button
                      key={vin}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => handleSelect(vin)}
                    >
                      <span className="font-mono tracking-wider">{vin}</span>
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    </button>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No VIN detected in photo.</p>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={retry}>
                <RefreshCw className="mr-2 size-4" />
                Retake photo
              </Button>
            </div>
          )}

          {/* Manual fallback */}
          <div className="space-y-2">
            <Label htmlFor="ocr-vin-manual">Or enter manually</Label>
            <div className="flex gap-2">
              <Input
                id="ocr-vin-manual"
                placeholder={placeholder}
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                maxLength={17}
                className="flex-1 font-mono uppercase"
              />
              <Button type="button" onClick={handleManualSubmit}>
                Use
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
