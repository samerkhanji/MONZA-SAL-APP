"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import {
  NOTE_TYPE_LABELS,
  NOTE_TYPE_ICONS,
} from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfileFullName } from "@/lib/supabase-profile";

const NOTE_TYPES = [
  "general",
  "call",
  "whatsapp",
  "visit",
  "follow_up",
  "complaint",
  "other",
] as const;

interface CustomerNoteRow {
  id: string;
  customer_id: string;
  note_type: string;
  content: string;
  created_by: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

interface CustomerNotesProps {
  customerId: string;
}

export function CustomerNotes({ customerId }: CustomerNotesProps) {
  const { canEditInventory } = useUser();
  const supabase = createClient();
  const [notes, setNotes] = useState<CustomerNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [noteType, setNoteType] = useState<string>("general");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchNotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_notes")
      .select("*, profiles:created_by(full_name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      setNotes((fallback as CustomerNoteRow[]) ?? []);
    } else {
      setNotes((data as CustomerNoteRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!customerId) return;
    fetchNotes();
  }, [customerId]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("customer_notes").insert({
      customer_id: customerId,
      note_type: noteType,
      content: content.trim(),
      created_by: user?.id ?? null,
    });

    setSubmitting(false);

    if (error) {
      toast.error(`Failed to add note: ${error.message}`);
      return;
    }

    toast.success("Note added");
    setContent("");
    setAddOpen(false);
    fetchNotes();
  }

  function getCreatorName(note: CustomerNoteRow): string {
    return getProfileFullName(note.profiles);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Interaction History</CardTitle>
            <CardDescription>Notes and interactions with this customer</CardDescription>
          </div>
          {canEditInventory && (
            <Button size="sm" onClick={() => setAddOpen(!addOpen)}>
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {addOpen && (
          <form
            onSubmit={handleAddNote}
            className="rounded-lg border p-4 space-y-4"
          >
            <div className="space-y-2">
              <Label>Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {NOTE_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter note content..."
                rows={3}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Note"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setContent("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No notes yet. Add your first interaction.
          </p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex gap-3 rounded-lg border p-4"
              >
                <span className="text-2xl shrink-0">
                  {NOTE_TYPE_ICONS[note.note_type] ?? "📝"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">
                      {NOTE_TYPE_LABELS[note.note_type] ?? note.note_type}
                    </span>
                    <span>·</span>
                    <span>By {getCreatorName(note)}</span>
                    <span>·</span>
                    <span>
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {note.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
