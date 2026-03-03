"use client";

/**
 * Customer Documents - All storage is in Supabase.
 * - Files: Supabase Storage bucket "customer-documents"
 * - Metadata: Supabase table "customer_documents"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Download, Eye } from "lucide-react";
import { getProfileFullName } from "@/lib/supabase-profile";

const CUSTOMER_DOCUMENT_TYPES = [
  { value: "id_passport", label: "ID / Passport" },
  { value: "contract", label: "Contract" },
  { value: "payment_receipt", label: "Payment Receipt" },
  { value: "insurance", label: "Insurance" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "power_of_attorney", label: "Power of Attorney" },
  { value: "other", label: "Other" },
] as const;

const CUSTOMER_DOC_TYPE_ICONS: Record<string, string> = {
  id_passport: "🪪",
  contract: "📋",
  payment_receipt: "🧾",
  insurance: "🛡️",
  drivers_license: "🪪",
  power_of_attorney: "📜",
  other: "📎",
};

const CUSTOMER_DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CUSTOMER_DOCUMENT_TYPES.map((t) => [t.value, t.label])
);

interface CustomerDocumentRow {
  id: string;
  customer_id: string;
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

interface CustomerDocumentsProps {
  customerId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CustomerDocuments({ customerId }: CustomerDocumentsProps) {
  const { canEditInventory, canDelete, appRole } = useUser();
  const canUpload = canPerform("customers", "edit", appRole ?? null);
  const canDeleteDocs = canPerform("customers", "delete", appRole ?? null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CustomerDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("id_passport");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function fetchDocuments() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_documents")
      .select("*, profiles:uploaded_by(full_name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("customer_documents")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      setDocuments((fallback as CustomerDocumentRow[]) ?? []);
    } else {
      setDocuments((data as CustomerDocumentRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!customerId) return;
    fetchDocuments();
  }, [customerId]);

  const filteredDocs =
    typeFilter === "all"
      ? documents
      : documents.filter((d) => d.document_type === typeFilter);

  const getDocumentUrl = useCallback(async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("customer-documents")
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

  async function handleDownload(doc: CustomerDocumentRow) {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
    }
  }

  async function handleDelete(doc: CustomerDocumentRow) {
    if (!canDeleteDocs) return;
    if (!confirm(`Delete "${doc.file_name}"?`)) return;

    const { error: storageError } = await supabase.storage
      .from("customer-documents")
      .remove([doc.file_path]);

    if (storageError) {
      toast.error(`Failed to delete file: ${storageError.message}`);
      return;
    }

    const { error: metaError } = await supabase
      .from("customer_documents")
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
    if (!uploadFile || !canUpload) return;

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
    const filePath = `${customerId}/${uploadType}/${timestamp}_${uploadFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("customer-documents")
      .upload(filePath, uploadFile, {
        contentType: uploadFile.type,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { error: metaError } = await supabase
      .from("customer_documents")
      .insert({
        customer_id: customerId,
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
      await supabase.storage.from("customer-documents").remove([filePath]);
      return;
    }

    toast.success("Document uploaded successfully");
    setUploadOpen(false);
    setUploadFile(null);
    setUploadNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocuments();
  }

  function getUploaderName(doc: CustomerDocumentRow): string {
    return getProfileFullName(doc.profiles);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                ID, contracts, receipts, insurance, and more
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canUpload && (
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
                  {CUSTOMER_DOCUMENT_TYPES.map((t) => (
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
              No documents uploaded yet. Upload ID, contracts, receipts, and
              other documents for this customer.
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
                      <span className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted/50 text-2xl">
                        {CUSTOMER_DOC_TYPE_ICONS[doc.document_type] ?? "📎"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {CUSTOMER_DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {doc.file_name}
                          {doc.file_size != null && ` · ${formatFileSize(doc.file_size)}`}
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
                        size="sm"
                        onClick={() => handleView(doc.file_path)}
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
              Add a document to this customer&apos;s file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type *</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_DOCUMENT_TYPES.map((t) => (
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
                setUploadNotes("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
