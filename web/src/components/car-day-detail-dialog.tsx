"use client";

/**
 * Day detail dialog - shows all events and documents for a specific day.
 * Allows uploading files (scans, reports) linked to that day.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import type { CarEvent } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Eye, FileText, Trash2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";

const DAY_DOC_TYPES = [
  { value: "job_card", label: "Job Card / Work Order" },
  { value: "inspection_photo", label: "Inspection / Scan Photo" },
  { value: "pdi_report", label: "PDI Report" },
  { value: "other_document", label: "Other Document" },
] as const;

interface DayDoc {
  id: string;
  document_type: string;
  file_name: string;
  file_path?: string;
  storage_path?: string;
  file_size?: number | null;
  file_size_bytes?: number | null;
  notes?: string | null;
  event_date?: string | null;
  created_at?: string;
  uploaded_at?: string;
}

function getDocPath(doc: DayDoc): string {
  return doc.file_path ?? doc.storage_path ?? "";
}

function getDocSize(doc: DayDoc): number | null {
  return doc.file_size ?? doc.file_size_bytes ?? null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string;
  dayEvents: CarEvent[];
  carId: string;
  carVin?: string | null;
  eventLabels: Record<string, string>;
  formatEventDisplay?: (ev: CarEvent) => string;
  onRefresh?: () => void;
}

export function DayDetailDialog({
  open,
  onOpenChange,
  dateStr,
  dayEvents,
  carId,
  carVin,
  eventLabels,
  formatEventDisplay,
  onRefresh,
}: DayDetailDialogProps) {
  const { canUploadDocuments, appRole } = useUser();
  const canDeleteCarDocs = canPerform("cars", "delete", appRole ?? null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DayDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadType, setUploadType] = useState<string>("job_card");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DayDoc | null>(null);

  const formatDateLabel = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const fetchDocuments = useCallback(async () => {
    if (!carId || !open) return;
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("car_documents")
      .select("*")
      .eq("car_id", carId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("car_documents")
        .select("*")
        .eq("car_id", carId)
        .order("created_at", { ascending: false });
      setDocuments((fallback as DayDoc[]) ?? []);
    } else {
      setDocuments((data as DayDoc[]) ?? []);
    }
    setLoadingDocs(false);
  }, [carId, open]);

  useEffect(() => {
    if (open) fetchDocuments();
  }, [open, fetchDocuments]);

  const dayDocs = documents.filter((d) => {
    const eventDate = (d as { event_date?: string }).event_date;
    const uploadedAt = d.created_at ?? d.uploaded_at ?? "";
    const uploadDate = uploadedAt
      ? new Date(uploadedAt).toISOString().slice(0, 10)
      : "";
    return eventDate === dateStr || uploadDate === dateStr;
  });

  const getDocumentUrl = useCallback(
    async (filePath: string): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from("car-documents")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    []
  );

  async function handleView(filePath: string) {
    const url = await getDocumentUrl(filePath);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  }

  async function handleDownload(doc: DayDoc) {
    const path = getDocPath(doc);
    const url = await getDocumentUrl(path);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
    } else toast.error("Could not download");
  }

  async function handleDelete(doc: DayDoc) {
    if (!canDeleteCarDocs) return;
    const res = await fetch(`/api/documents/car/${doc.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
      return;
    }
    toast.success("Document deleted");
    fetchDocuments();
    onRefresh?.();
  }

  async function handleUpload() {
    if (!uploadFile || !canUploadDocuments) return;
    const isPdf = uploadFile.type === "application/pdf";
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(
      uploadFile.type
    );
    if (!isPdf && !isImage) {
      toast.error("Only PDF and images (JPEG, PNG, WebP) allowed");
      return;
    }
    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    const timestamp = Date.now();
    const filePath = `${carId}/${uploadType}/${timestamp}_${uploadFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("car-documents")
      .upload(filePath, uploadFile, {
        contentType: uploadFile.type,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      toast.error(`Upload failed: ${formatError(uploadError)}`);
      return;
    }

    const docType = uploadType === "pdi_report" ? "pdi" : uploadType;
    let metaError = (
      await supabase.from("car_documents").insert({
        car_id: carId,
        document_type: docType,
        file_name: uploadFile.name,
        file_path: filePath,
        storage_path: filePath,
        file_size: uploadFile.size,
        file_size_bytes: uploadFile.size,
        mime_type: uploadFile.type,
        notes: uploadNotes.trim() || null,
        uploaded_by: user.id,
        event_date: dateStr,
      })
    ).error;

    if (metaError) {
      metaError = (
        await supabase.from("car_documents").insert({
          car_id: carId,
          document_type: docType,
          file_name: uploadFile.name,
          storage_path: filePath,
          file_size_bytes: uploadFile.size,
          uploaded_by: user.id,
          event_date: dateStr,
        })
      ).error;
    }

    if (metaError) {
      metaError = (
        await supabase.from("car_documents").insert({
          car_id: carId,
          document_type: docType,
          file_name: uploadFile.name,
          storage_path: filePath,
          file_size_bytes: uploadFile.size,
          uploaded_by: user.id,
        })
      ).error;
    }

    if (metaError) {
      toast.error(`Failed to save metadata: ${formatError(metaError)}`);
      await supabase.storage.from("car-documents").remove([filePath]);
    }

    setUploading(false);
    toast.success("File added for this day");
    setUploadFile(null);
    setUploadNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
    onRefresh?.();
  }

  const sortedEvents = [...dayEvents].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {formatDateLabel(dateStr)} — Activity & Files
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Events for this day */}
          <div>
            <h3 className="mb-2 font-medium">What was done</h3>
            {sortedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No recorded activity for this day.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-col gap-0.5 rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {eventLabels[ev.event_type] ?? ev.event_type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p>
                      {formatEventDisplay
                        ? formatEventDisplay(ev)
                        : ev.from_value && ev.to_value
                          ? `${ev.from_value} → ${ev.to_value}`
                          : ev.to_value ?? ev.from_value ?? ev.event_type}
                    </p>
                    {ev.note && <p className="text-muted-foreground">{ev.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Files for this day */}
          <div>
            <h3 className="mb-2 font-medium">Files (scans, reports, documents)</h3>
            {loadingDocs ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : dayDocs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No files for this day. Upload a scan, job card, or report below.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.file_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {getDocSize(doc) != null
                            ? formatFileSize(getDocSize(doc)!)
                            : ""}
                          {doc.notes ? ` · ${doc.notes}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(getDocPath(doc))}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {canDeleteCarDocs && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(doc)}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upload for this day */}
          {canUploadDocuments && (
            <div className="rounded-lg border border-dashed p-4">
              <h3 className="mb-3 font-medium">Add file for this day</h3>
              <p className="mb-3 text-muted-foreground text-sm">
                Upload a scan, job card, or report to attach to this day.
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_DOC_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="block w-full text-sm"
                    onChange={(e) =>
                      setUploadFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="e.g. Scan at arrival, brake inspection..."
                    rows={2}
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                >
                  <Upload className="mr-2 size-4" />
                  {uploading ? "Uploading..." : "Upload for this day"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={deleteTarget !== null}
      onOpenChange={(o) => !o && setDeleteTarget(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget
              ? `"${deleteTarget.file_name}" will be permanently removed.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteTarget) {
                void handleDelete(deleteTarget);
                setDeleteTarget(null);
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
