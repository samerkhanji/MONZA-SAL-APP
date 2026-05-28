"use client";

/**
 * Car Documents - All storage is in Supabase.
 * - Files: Supabase Storage bucket "car-documents"
 * - Metadata: Supabase table "car_documents"
 * - No localStorage, sessionStorage, or local file writes.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Download, Eye } from "lucide-react";
import { getProfileFullName } from "@/lib/supabase-profile";
import { formatError } from "@/lib/error-messages";

const DOCUMENT_TYPES = [
  { value: "pdi_report", label: "PDI Report" },
  { value: "job_card", label: "Job Card" },
  { value: "inspection_photo", label: "Inspection Photo" },
  { value: "customer_document", label: "Customer Document" },
  { value: "insurance_document", label: "Insurance Document" },
  { value: "customs_document", label: "Customs Document" },
  { value: "other_document", label: "Other PDF / Document" },
] as const;

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  pdi_report: "📄",
  job_card: "🔧",
  inspection_photo: "📸",
  customer_document: "👤",
  insurance_document: "🛡️",
  customs_document: "📦",
  other_document: "📄",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label])
);

function ThumbnailPreview({
  filePath,
  fileName,
  getUrl,
  onView,
}: {
  filePath: string;
  fileName: string;
  getUrl: (path: string) => Promise<string | null>;
  onView: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    getUrl(filePath).then(setSrc);
  }, [filePath, getUrl]);
  return (
    <button
      type="button"
      onClick={onView}
      className="shrink-0 overflow-hidden rounded border"
    >
      {src ? (
        <img
          src={src}
          alt={fileName}
          className="size-16 object-cover"
        />
      ) : (
        <div className="flex size-16 items-center justify-center bg-muted text-2xl">
          📸
        </div>
      )}
    </button>
  );
}

interface CarDocumentRow {
  id: string;
  car_id: string;
  document_type: string;
  file_name: string;
  file_path?: string;
  storage_path?: string; // legacy column name
  file_size?: number | null;
  file_size_bytes?: number | null; // legacy column name
  mime_type?: string | null;
  notes?: string | null;
  uploaded_by: string | null;
  created_at?: string;
  uploaded_at?: string; // legacy column name
  profiles?: { full_name: string | null } | null;
}

interface CarDocumentsProps {
  carId: string;
  carVin?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Use the user's custom name when provided, preserving the file extension. */
function applyCustomName(customName: string, originalName: string): string {
  const trimmed = customName.trim();
  if (!trimmed) return originalName;
  const dot = originalName.lastIndexOf(".");
  const ext = dot > 0 ? originalName.slice(dot) : "";
  return ext && !trimmed.toLowerCase().endsWith(ext.toLowerCase())
    ? trimmed + ext
    : trimmed;
}

function getDocPath(doc: CarDocumentRow): string {
  return doc.file_path ?? doc.storage_path ?? "";
}

function getDocSize(doc: CarDocumentRow): number | null {
  return doc.file_size ?? doc.file_size_bytes ?? null;
}

function getDocDate(doc: CarDocumentRow): string {
  return doc.created_at ?? doc.uploaded_at ?? "";
}

function getDocTypeLabel(doc: CarDocumentRow): string {
  const type = doc.document_type;
  if (type === "pdi") return "PDI Report";
  if (type === "job_card") return "Job Card";
  if (type === "other_document") return "Other PDF / Document";
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

function getDocTypeIcon(doc: CarDocumentRow): string {
  const type = doc.document_type;
  if (type === "pdi") return "📄";
  if (type === "job_card") return "🔧";
  if (type === "other_document") return "📄";
  return DOCUMENT_TYPE_ICONS[type] ?? "📄";
}

export function CarDocuments({ carId, carVin }: CarDocumentsProps) {
  const { canUploadDocuments, appRole } = useUser();
  const canDeleteCarDocs = canPerform("cars", "delete", appRole ?? null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CarDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("pdi_report");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<CarDocumentRow | null>(null);

  async function fetchDocuments() {
    setLoading(true);
    const { data, error } = await supabase
      .from("car_documents")
      .select("*, profiles:uploaded_by(full_name)")
      .eq("car_id", carId)
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback: try without profiles join (if FK to profiles doesn't exist)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("car_documents")
        .select("*")
        .eq("car_id", carId)
        .order("uploaded_at", { ascending: false });

      if (fallbackError) {
        toast.error("Failed to load documents");
        setDocuments([]);
      } else {
        setDocuments((fallbackData as unknown as CarDocumentRow[]) ?? []);
      }
    } else {
      // uploaded_by → profiles FK not auto-detected by PostgREST type inference.
      setDocuments((data as unknown as CarDocumentRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!carId) return;
    fetchDocuments();
  }, [carId]);

  const filteredDocs =
    typeFilter === "all"
      ? documents
      : documents.filter((d) => {
          const t = d.document_type;
          if (typeFilter === "pdi_report") return t === "pdi_report" || t === "pdi";
          return t === typeFilter;
        });

  const getDocumentUrl = useCallback(async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("car-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      toast.error("Failed to get document URL");
      return null;
    }
    return data.signedUrl;
  }, []);

  async function handleView(filePath: string) {
    const url = await getDocumentUrl(filePath);
    if (url) window.open(url, "_blank");
  }

  async function handleDownload(doc: CarDocumentRow) {
    const path = getDocPath(doc);
    const url = await getDocumentUrl(path);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
    }
  }

  async function handleDelete(doc: CarDocumentRow) {
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
  }

  async function handleUpload() {
    if (!uploadFile || !canUploadDocuments) return;

    const isPdf = uploadFile.type === "application/pdf";
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(uploadFile.type);
    if (!isPdf && !isImage) {
      toast.error("Only PDF and image files (JPEG, PNG, WebP) are allowed");
      return;
    }

    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
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

    const { error: metaError } = await supabase.from("car_documents").insert({
      car_id: carId,
      document_type: uploadType,
      file_name: applyCustomName(uploadName, uploadFile.name),
      file_path: filePath,
      file_size: uploadFile.size,
      mime_type: uploadFile.type,
      notes: uploadNotes.trim() || null,
      uploaded_by: user.id,
    });

    setUploading(false);

    if (metaError) {
      toast.error(`File uploaded but failed to save metadata: ${formatError(metaError)}`);
      await supabase.storage.from("car-documents").remove([filePath]);
      return;
    }

    toast.success("Document uploaded successfully");
    setUploadOpen(false);
    setUploadFile(null);
    setUploadName("");
    setUploadNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
  }

  function getUploaderName(doc: CarDocumentRow): string {
    return getProfileFullName(doc.profiles);
  }

  const isImageType = (mime: string | null | undefined) =>
    (mime ?? "").startsWith("image/");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {carVin
                  ? `PDFs and documents for VIN ${carVin}`
                  : "PDI reports, job cards, PDFs, and more"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canUploadDocuments && (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-2 size-4" />
                  Upload Document
                </Button>
              )}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : filteredDocs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No documents uploaded yet. Upload PDI reports, job cards, and
              other documents for this vehicle.
            </p>
          ) : (
            <ul className="space-y-4">
              {filteredDocs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {doc.document_type === "inspection_photo" &&
                      isImageType(doc.mime_type) ? (
                        <ThumbnailPreview
                          filePath={getDocPath(doc)}
                          fileName={doc.file_name}
                          getUrl={getDocumentUrl}
                          onView={() => handleView(getDocPath(doc))}
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted/50 text-2xl">
                          {getDocTypeIcon(doc)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {getDocTypeLabel(doc)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {doc.file_name}
                          {getDocSize(doc) != null &&
                            ` · ${formatFileSize(getDocSize(doc)!)}`}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Uploaded by {getUploaderName(doc)} ·{" "}
                          {new Date(getDocDate(doc)).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {doc.notes && (
                          <p className="mt-1 text-muted-foreground text-sm">
                            Note: {doc.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(getDocPath(doc))}
                      >
                        <Eye className="mr-1 size-3.5" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="mr-1 size-3.5" />
                        Download
                      </Button>
                      {canDeleteCarDocs && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(doc)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setUploadFile(null);
            setUploadName("");
            setUploadNotes("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document to this vehicle&apos;s file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type *</Label>
              <Select
                value={uploadType}
                onValueChange={setUploadType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="car-doc-name">Document name (optional)</Label>
              <Input
                id="car-doc-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Leave blank to use the file name"
              />
            </div>
            <div className="space-y-2">
              <Label>File *</Label>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                {uploadFile ? (
                  <p className="text-sm font-medium">{uploadFile.name}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Choose file or drop here
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  PDF, JPEG, PNG, WebP · Max 10 MB
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-notes">Notes (optional)</Label>
              <Textarea
                id="upload-notes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setUploadFile(null);
                setUploadName("");
                setUploadNotes("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
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
