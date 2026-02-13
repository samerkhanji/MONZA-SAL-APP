"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Download, Eye } from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "pdi_report", label: "PDI Report" },
  { value: "job_card", label: "Job Card" },
  { value: "inspection_photo", label: "Inspection Photo" },
  { value: "customer_document", label: "Customer Document" },
  { value: "insurance_document", label: "Insurance Document" },
  { value: "customs_document", label: "Customs Document" },
] as const;

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  pdi_report: "📄",
  job_card: "🔧",
  inspection_photo: "📸",
  customer_document: "👤",
  insurance_document: "🛡️",
  customs_document: "📦",
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
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

function getDocTypeIcon(doc: CarDocumentRow): string {
  const type = doc.document_type;
  if (type === "pdi") return "📄";
  if (type === "job_card") return "🔧";
  return DOCUMENT_TYPE_ICONS[type] ?? "📄";
}

export function CarDocuments({ carId }: CarDocumentsProps) {
  const { canUploadDocuments, canDelete } = useUser();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CarDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("pdi_report");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

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
        setDocuments((fallbackData as CarDocumentRow[]) ?? []);
      }
    } else {
      setDocuments((data as CarDocumentRow[]) ?? []);
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
    if (!canDelete) return;
    if (!confirm(`Delete "${doc.file_name}"?`)) return;

    const path = getDocPath(doc);
    const { error: storageError } = await supabase.storage
      .from("car-documents")
      .remove([path]);

    if (storageError) {
      toast.error(`Failed to delete file: ${storageError.message}`);
      return;
    }

    const { error: metaError } = await supabase
      .from("car_documents")
      .delete()
      .eq("id", doc.id);

    if (metaError) {
      toast.error(`File deleted but metadata remains: ${metaError.message}`);
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

    // Map to legacy enum if needed (pdi_report -> pdi)
    const legacyType = uploadType === "pdi_report" ? "pdi" : uploadType;

    const { error: uploadError } = await supabase.storage
      .from("car-documents")
      .upload(filePath, uploadFile, {
        contentType: uploadFile.type,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    // Try new schema first (file_path, file_size, mime_type, notes, created_at)
    let metaError = (
      await supabase.from("car_documents").insert({
        car_id: carId,
        document_type: uploadType,
        file_name: uploadFile.name,
        file_path: filePath,
        file_size: uploadFile.size,
        mime_type: uploadFile.type,
        notes: uploadNotes.trim() || null,
        uploaded_by: user.id,
      })
    ).error;

    // Fallback: legacy schema (storage_path, file_size_bytes, document_type enum)
    if (metaError && (uploadType === "pdi_report" || uploadType === "job_card")) {
      metaError = (
        await supabase.from("car_documents").insert({
          car_id: carId,
          document_type: legacyType,
          file_name: uploadFile.name,
          storage_path: filePath,
          file_size_bytes: uploadFile.size,
          uploaded_by: user.id,
        })
      ).error;
    }

    setUploading(false);

    if (metaError) {
      toast.error(`File uploaded but failed to save metadata: ${metaError.message}`);
      await supabase.storage.from("car-documents").remove([filePath]);
      return;
    }

    toast.success("Document uploaded successfully");
    setUploadOpen(false);
    setUploadFile(null);
    setUploadNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
  }

  function getUploaderName(doc: CarDocumentRow): string {
    const profiles = doc.profiles as { full_name?: string } | undefined;
    return profiles?.full_name ?? "Unknown";
  }

  const isImageType = (mime: string | null) =>
    mime?.startsWith("image/") ?? false;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                PDI reports, job cards, inspection photos, and more
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
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(doc)}
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
                  PDF, JPEG, PNG · Max 10 MB
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
    </>
  );
}
