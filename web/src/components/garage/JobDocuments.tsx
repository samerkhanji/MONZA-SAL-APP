"use client";

/**
 * Job Documents - Storage in Supabase.
 * - Files: Supabase Storage bucket "job-documents"
 * - Metadata: Supabase table "job_documents"
 * - Path: {job_id}/{document_type}/{timestamp}_{filename}
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { JOB_DOCUMENT_TYPES } from "@/lib/constants/jobs";
import { Button } from "@/components/ui/button";
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

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  job_card: "🔧",
  diagnosis_report: "📋",
  photo_before: "📸",
  photo_after: "📸",
  other: "📄",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  JOB_DOCUMENT_TYPES.map((t) => [t.value, t.label])
);

interface JobDocumentRow {
  id: string;
  job_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

interface JobDocumentsProps {
  jobId: string;
  onDocumentsChange?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocTypeLabel(doc: JobDocumentRow): string {
  return DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type;
}

function getDocTypeIcon(doc: JobDocumentRow): string {
  return DOCUMENT_TYPE_ICONS[doc.document_type] ?? "📄";
}

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
        <img src={src} alt={fileName} className="size-16 object-cover" />
      ) : (
        <div className="flex size-16 items-center justify-center bg-muted text-2xl">
          📸
        </div>
      )}
    </button>
  );
}

export function JobDocuments({ jobId, onDocumentsChange }: JobDocumentsProps) {
  const { canManageGarage, canDelete } = useUser();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<JobDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("job_card");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function fetchDocuments() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_documents")
      .select("*, profiles:uploaded_by(full_name)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("job_documents")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      setDocuments((fallback as JobDocumentRow[]) ?? []);
    } else {
      setDocuments((data as JobDocumentRow[]) ?? []);
    }
    setLoading(false);
    onDocumentsChange?.();
  }

  useEffect(() => {
    if (!jobId) return;
    fetchDocuments();
  }, [jobId]);

  const filteredDocs =
    typeFilter === "all"
      ? documents
      : documents.filter((d) => d.document_type === typeFilter);

  const getDocumentUrl = useCallback(
    async (filePath: string): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from("job-documents")
        .createSignedUrl(filePath, 3600);

      if (error || !data?.signedUrl) {
        toast.error("Failed to get document URL");
        return null;
      }
      return data.signedUrl;
    },
    []
  );

  async function handleView(filePath: string) {
    const url = await getDocumentUrl(filePath);
    if (url) window.open(url, "_blank");
  }

  async function handleDownload(doc: JobDocumentRow) {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
    }
  }

  async function handleDelete(doc: JobDocumentRow) {
    if (!canManageGarage || !canDelete) return;
    if (!confirm(`Delete "${doc.file_name}"?`)) return;

    const { error: storageError } = await supabase.storage
      .from("job-documents")
      .remove([doc.file_path]);

    if (storageError) {
      toast.error(`Failed to delete file: ${storageError.message}`);
      return;
    }

    const { error: metaError } = await supabase
      .from("job_documents")
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
    if (!uploadFile || !canManageGarage) return;

    const isPdf = uploadFile.type === "application/pdf";
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(
      uploadFile.type
    );
    if (!isPdf && !isImage) {
      toast.error("Only PDF and image files (JPEG, PNG, WebP) are allowed");
      return;
    }

    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }

    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    const timestamp = Date.now();
    const filePath = `${jobId}/${uploadType}/${timestamp}_${uploadFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(filePath, uploadFile, {
        contentType: uploadFile.type,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { error: metaError } = await supabase.from("job_documents").insert({
      job_id: jobId,
      document_type: uploadType,
      file_name: uploadFile.name,
      file_path: filePath,
      file_size: uploadFile.size,
      mime_type: uploadFile.type,
      notes: uploadNotes.trim() || null,
      uploaded_by: user.id,
    });

    setUploading(false);

    if (metaError) {
      toast.error(`File uploaded but failed to save metadata: ${metaError.message}`);
      await supabase.storage.from("job-documents").remove([filePath]);
      return;
    }

    toast.success("Document uploaded");
    setUploadOpen(false);
    setUploadFile(null);
    setUploadNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
  }

  function getUploaderName(doc: JobDocumentRow): string {
    const profiles = doc.profiles as { full_name?: string } | undefined;
    return profiles?.full_name ?? "Unknown";
  }

  const isImageType = (mime: string | null | undefined) =>
    (mime ?? "").startsWith("image/");

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Documents</h3>
            <p className="text-muted-foreground text-sm">
              Job cards, diagnosis reports, before/after photos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageGarage && (
              <Button size="lg" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 size-4" />
                Upload
              </Button>
            )}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="min-h-11 w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {JOB_DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : filteredDocs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No documents yet. Upload job cards, diagnosis reports, or photos.
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
                    {isImageType(doc.mime_type) ? (
                      <ThumbnailPreview
                        filePath={doc.file_path}
                        fileName={doc.file_name}
                        getUrl={getDocumentUrl}
                        onView={() => handleView(doc.file_path)}
                      />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted/50 text-2xl">
                        {getDocTypeIcon(doc)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{getDocTypeLabel(doc)}</p>
                      <p className="text-muted-foreground text-sm">
                        {doc.file_name}
                        {doc.file_size != null &&
                          ` · ${formatFileSize(doc.file_size)}`}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Uploaded by {getUploaderName(doc)} ·{" "}
                        {new Date(doc.created_at).toLocaleDateString("en-US", {
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
                      size="lg"
                      onClick={() => handleView(doc.file_path)}
                    >
                      <Eye className="mr-1 size-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="mr-1 size-4" />
                      Download
                    </Button>
                    {canManageGarage && canDelete && (
                      <Button
                        variant="outline"
                        size="lg"
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
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-background p-6">
            <h3 className="mb-4 text-lg font-semibold">Upload Document</h3>
            <div className="space-y-4">
              <div>
                <Label>Document Type *</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="mt-1 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File *</Label>
                <div
                  className="mt-1 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      setUploadFile(e.target.files?.[0] ?? null)
                    }
                  />
                  {uploadFile ? (
                    <p className="text-sm font-medium">{uploadFile.name}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Tap to choose file
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    PDF, JPEG, PNG, WebP · Max 10 MB
                  </p>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                size="lg"
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
                size="lg"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
