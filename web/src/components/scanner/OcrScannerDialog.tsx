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
import type { Worker as TesseractWorker } from "tesseract.js";

// VIN chars only — by spec a VIN never contains I, O or Q.
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;
const VIN_EXACT = /^[A-HJ-NPR-Z0-9]{17}$/;

// ISO 3779 VIN check-digit (position 9). Computed from the other 16 chars, it
// catches OCR misreads and pure noise (e.g. a moiré read of a screen) that
// happen to be 17 chars but aren't real VINs. Voyah/MHero VINs comply with it.
const VIN_TRANSLITERATION: Record<string, number> = {
  A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,
  J:1,K:2,L:3,M:4,N:5,P:7,R:9,
  S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
  "0":0,"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,
};
const VIN_WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

function vinCheckDigitValid(vin: string): boolean {
  if (!VIN_EXACT.test(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const v = VIN_TRANSLITERATION[vin[i]];
    if (v === undefined) return false;
    sum += v * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected;
}

// Self-hosted Tesseract assets (copied into /public by scripts/copy-tesseract-assets.mjs).
const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract";
// Language data is fetched from jsDelivr at runtime (allowed in connect-src).
const LANG_PATH = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int";

/**
 * Normalises OCR output before VIN extraction. The whitelist already excludes
 * I/O/Q, but as a safety net we still fold common look-alikes (O→0, I→1, Q→0)
 * in case some sneak through, then keep only 17-char runs of valid VIN chars.
 *
 * Only candidates whose ISO 3779 check digit is valid are returned. This is
 * what throws out screen-moiré garbage and OCR misreads: a real Voyah/MHero
 * VIN passes, a wrong read almost never does. If nothing passes, we return
 * nothing — the dialog then says "No VIN detected, retake", which is the
 * honest result rather than offering a wrong VIN. (Manual paste stays available
 * for the rare non-compliant VIN, e.g. an odd trade-in.)
 */
function extractVins(rawText: string): string[] {
  const normalised = rawText
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/Q/g, "0")
    .replace(/[^A-HJ-NPR-Z0-9]/g, " ");
  const matches = [...new Set(normalised.match(VIN_PATTERN) ?? [])];
  return matches.filter(vinCheckDigitValid);
}

/**
 * Crop the framed band, upscale, grayscale + contrast-stretch — gives Tesseract
 * a clean, high-contrast single line which dramatically improves VIN accuracy.
 */
function preprocess(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): HTMLCanvasElement {
  const scale = 2;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  // First pass: luminance + min/max for a contrast stretch.
  let min = 255;
  let max = 0;
  const lum = new Uint8Array(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j += 1) {
    const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    lum[j] = l;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const range = Math.max(1, max - min);
  for (let i = 0, j = 0; i < d.length; i += 4, j += 1) {
    const v = ((lum[j] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
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
 * Opens the rear camera with a guide box, captures the framed band, runs a
 * VIN-tuned Tesseract.js worker (self-hosted core, character whitelist,
 * single-block page-seg, image preprocessing) and extracts 17-char VINs.
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
  const workerRef = useRef<TesseractWorker | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Reading VIN…");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const terminateWorker = useCallback(() => {
    const w = workerRef.current;
    workerRef.current = null;
    if (w) void w.terminate().catch(() => {});
  }, []);

  const startStream = useCallback(async () => {
    setCameraError(null);
    setVideoReady(false);
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
        // iOS Safari sometimes needs an explicit play().
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "Camera permission denied. Use manual entry below."
          : "Camera unavailable. Use manual entry below."
      );
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      terminateWorker();
      setPhase("capture");
      setCandidates([]);
      setCapturedDataUrl(null);
      setManualValue("");
      setCameraError(null);
      setVideoReady(false);
      setProgress(0);
      return;
    }
    void startStream();
    return () => {
      stopStream();
      terminateWorker();
    };
  }, [open, startStream, stopStream, terminateWorker]);

  /** Lazily create + configure the VIN-tuned Tesseract worker (reused across retries). */
  const getWorker = useCallback(async (): Promise<TesseractWorker> => {
    if (workerRef.current) return workerRef.current;
    const { createWorker, PSM } = await import("tesseract.js");
    setProgressLabel("Loading OCR engine…");
    const worker = await createWorker("eng", 1, {
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          setProgressLabel("Reading VIN…");
          setProgress(Math.round((m.progress ?? 0) * 100));
        }
      },
    });
    await worker.setParameters({
      tessedit_char_whitelist: VIN_CHARS,
      // 6 = assume a single uniform block of text (our cropped VIN band).
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    workerRef.current = worker;
    return worker;
  }, []);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      toast.error("Camera still warming up — try again in a second.");
      return;
    }

    // Draw the full frame for the preview thumbnail.
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, vw, vh);
    setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.92));

    setProgress(0);
    setPhase("processing");

    // Crop to the centered guide band (matches the on-screen overlay), then
    // preprocess for OCR.
    const bandW = vw * 0.92;
    const bandH = vh * 0.22;
    const bandX = (vw - bandW) / 2;
    const bandY = (vh - bandH) / 2;
    const processed = preprocess(video, bandX, bandY, bandW, bandH);

    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(processed);
      const found = extractVins(data.text ?? "");
      setCandidates(found);
      if (found.length === 0) {
        toast.warning("No VIN found. Align the VIN inside the box, hold steady, and retake.");
      }
    } catch {
      toast.error("OCR failed. Retake the photo or use manual entry.");
    } finally {
      stopStream();
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
    if (!VIN_EXACT.test(value)) {
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
    setProgress(0);
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
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => setVideoReady(true)}
                    className="w-full"
                    style={{ minHeight: 200 }}
                  />
                  {/* Guide box — align the VIN inside this band */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[22%] w-[92%] rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                  </div>
                  <p className="absolute inset-x-0 bottom-1 text-center text-[11px] text-white/90">
                    Align the VIN inside the box
                  </p>
                </>
              ))}

            {phase === "processing" && capturedDataUrl && (
              <div className="relative">
                <img src={capturedDataUrl} alt="Captured" className="w-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                  <RefreshCw className="size-8 animate-spin text-white" />
                  <p className="mt-2 text-sm font-medium text-white">{progressLabel}</p>
                  {progress > 0 && (
                    <p className="text-xs text-white/80">{progress}%</p>
                  )}
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
            <Button
              className="w-full"
              onClick={() => void capture()}
              disabled={!videoReady}
            >
              <Camera className="mr-2 size-4" />
              {videoReady ? "Capture & Read VIN" : "Starting camera…"}
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
