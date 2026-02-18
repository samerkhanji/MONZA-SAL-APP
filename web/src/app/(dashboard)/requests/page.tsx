"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { Request } from "@/types/database";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_CATEGORIES,
} from "@/lib/constants/requests";
import { getAllProfiles } from "@/lib/user-lookup";
import { createNotification, createNotificationsForUsers } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, MessageSquare, ChevronRight } from "lucide-react";

interface RequestWithProfiles extends Request {
  submitter?: { full_name: string | null } | null;
  assignee?: { full_name: string | null } | null;
  reviewer?: { full_name: string | null } | null;
  send_to_user?: { full_name: string | null } | null;
}

function PriorityBadge({ priority }: { priority: string }) {
  const emoji =
    priority === "low" ? "🟢" : priority === "urgent" ? "🔴" : "🟡";
  const color =
    priority === "low"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : priority === "urgent"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      <span>{emoji}</span>
      {REQUEST_PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

const OWNER_SEND_TO_MAP: Record<string, string> = {
  houssam: "houssam",
  kareem: "kareem",
  samer: "samer",
};

function getSendToLabel(r: RequestWithProfiles): string {
  if (r.send_to_user?.full_name) return r.send_to_user.full_name;
  if (r.send_to && OWNER_SEND_TO_MAP[r.send_to]) {
    const names: Record<string, string> = { houssam: "Houssam", kareem: "Kareem", samer: "Samer" };
    return names[r.send_to] ?? r.send_to;
  }
  return r.send_to ?? "—";
}

export default function RequestCenterPage() {
  const { profile, isRequestAssistant, isRequestManagement, isSamer, isKareem, isHoussam } = useUser();
  const [requests, setRequests] = useState<RequestWithProfiles[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<RequestWithProfiles | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sendToFilter, setSendToFilter] = useState<string>("all");
  const [submittedByFilter, setSubmittedByFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "status">("date");

  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>("none");
  const [newSendToUserId, setNewSendToUserId] = useState<string>("");
  const [newSubmitting, setNewSubmitting] = useState(false);

  const [assistantNotes, setAssistantNotes] = useState("");
  const [assistantPriority, setAssistantPriority] = useState<string>("normal");
  const [managementComments, setManagementComments] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const supabase = createClient();

  async function fetchRequests() {
    setLoading(true);
    const [reqResult, profilesResult] = await Promise.all([
      supabase.from("requests").select("*").order("created_at", { ascending: false }),
      getAllProfiles(),
    ]);

    const { data, error } = reqResult;
    if (error) {
      toast.error("Failed to load requests");
      setRequests([]);
      setLoading(false);
      return;
    }

    setAllProfiles(profilesResult);

    const list = (data as Request[]) ?? [];
    const userIds = new Set<string>();
    list.forEach((r) => {
      if (r.submitted_by) userIds.add(r.submitted_by);
      if (r.assigned_to) userIds.add(r.assigned_to);
      if (r.reviewed_by) userIds.add(r.reviewed_by);
      if (r.send_to_user_id) userIds.add(r.send_to_user_id);
    });

    let profilesMap: Record<string, { full_name: string | null }> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      profilesMap = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
          p.id,
          { full_name: p.full_name },
        ])
      );
    }

    const withProfiles: RequestWithProfiles[] = list.map((r) => ({
      ...r,
      submitter: profilesMap[r.submitted_by] ?? null,
      assignee: r.assigned_to ? (profilesMap[r.assigned_to] ?? null) : null,
      reviewer: r.reviewed_by ? (profilesMap[r.reviewed_by] ?? null) : null,
      send_to_user: r.send_to_user_id ? (profilesMap[r.send_to_user_id] ?? null) : null,
    }));

    setRequests(withProfiles);
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (!newOpen) {
      setNewSendToUserId("");
    }
  }, [newOpen]);

  const visibleRequests = useMemo(() => {
    const myId = profile?.id;
    if (!myId) return [];

    let list = [...requests];

    if (isRequestAssistant) {
      const forReview = list.filter(
        (r) => r.send_to === "houssam" || r.send_to === "kareem"
      );
      const myPersonal = list.filter(
        (r) =>
          r.submitted_by === myId ||
          r.send_to_user_id === myId ||
          r.assigned_to === myId
      );
      const combined = [...forReview];
      for (const r of myPersonal) {
        if (!combined.find((x) => x.id === r.id)) combined.push(r);
      }
      return combined;
    }

    if (isRequestManagement || isSamer || isKareem || isHoussam) {
      const forOwners = list.filter(
        (r) =>
          r.send_to === "samer" ||
          r.send_to === "kareem" ||
          (r.send_to === "houssam" && r.status === "awaiting_approval")
      );
      const myPersonal = list.filter(
        (r) =>
          r.submitted_by === myId ||
          r.send_to_user_id === myId ||
          r.assigned_to === myId
      );
      const combined = [...forOwners];
      for (const r of myPersonal) {
        if (!combined.find((x) => x.id === r.id)) combined.push(r);
      }
      return combined;
    }

    return list.filter(
      (r) =>
        r.submitted_by === myId ||
        r.send_to_user_id === myId ||
        r.assigned_to === myId
    );
  }, [requests, profile?.id, isRequestAssistant, isRequestManagement, isSamer, isKareem, isHoussam]);

  const uniqueSubmitters = useMemo(() => {
    const map = new Map<string, string>();
    visibleRequests.forEach((r) => {
      if (r.submitted_by && (r as RequestWithProfiles).submitter?.full_name) {
        map.set(r.submitted_by, (r as RequestWithProfiles).submitter!.full_name!);
      }
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [visibleRequests]);

  const uniqueSendToOptions = useMemo(() => {
    const map = new Map<string, string>();
    visibleRequests.forEach((r) => {
      const label = getSendToLabel(r as RequestWithProfiles);
      const key = r.send_to_user_id ?? r.send_to ?? "unknown";
      if (label) map.set(key, label);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleRequests]);

  const filteredRequests = useMemo(() => {
    let list = [...visibleRequests];
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (priorityFilter !== "all") {
      if (priorityFilter === "unlabeled") {
        list = list.filter(
          (r) => r.send_to === "houssam" && r.status === "submitted"
        );
      } else {
        list = list.filter((r) => r.priority === priorityFilter);
      }
    }
    if (sendToFilter !== "all") {
      list = list.filter(
        (r) =>
          r.send_to === sendToFilter || r.send_to_user_id === sendToFilter
      );
    }
    if (submittedByFilter !== "all")
      list = list.filter((r) => r.submitted_by === submittedByFilter);
    if (dateFromFilter) {
      list = list.filter(
        (r) => new Date(r.created_at) >= new Date(dateFromFilter)
      );
    }
    if (dateToFilter) {
      const to = new Date(dateToFilter);
      to.setHours(23, 59, 59, 999);
      list = list.filter((r) => new Date(r.created_at) <= to);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.subject.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          (r as RequestWithProfiles).submitter?.full_name?.toLowerCase().includes(q)
      );
    }
    if (sortBy === "date") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "priority") {
      const order = { urgent: 0, normal: 1, low: 2 };
      list.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
    } else {
      const order = {
        submitted: 0,
        awaiting_approval: 1,
        needs_more_info: 2,
        approved: 3,
        rejected: 4,
      };
      list.sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0));
    }
    return list;
  }, [
    visibleRequests,
    statusFilter,
    priorityFilter,
    sendToFilter,
    submittedByFilter,
    dateFromFilter,
    dateToFilter,
    search,
    sortBy,
  ]);

  function getSendToForUserId(userId: string): string | null {
    const p = allProfiles.find((pr) => pr.id === userId);
    if (!p?.full_name) return null;
    const name = p.full_name.toLowerCase();
    if (name.includes("houssam")) return "houssam";
    if (name.includes("kareem")) return "kareem";
    if (name.includes("samer")) return "samer";
    return null;
  }

  async function handleSubmitRequest() {
    if (!newSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!newSendToUserId) {
      toast.error("Send To is required");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    setNewSubmitting(true);

    const sendTo = getSendToForUserId(newSendToUserId);
    const isDirectToOwner = sendTo === "samer" || sendTo === "kareem";
    const isToHoussam = sendTo === "houssam";
    let assignedTo: string | null = null;
    let status: string = "submitted";
    const effectiveSendTo = sendTo ?? "employee";

    if (isDirectToOwner || !sendTo) {
      status = "awaiting_approval";
      assignedTo = newSendToUserId;
    } else if (isToHoussam) {
      status = "submitted";
      assignedTo = null;
    }

    const { error } = await supabase
      .from("requests")
      .insert({
        subject: newSubject.trim(),
        description: newDescription.trim() || null,
        category: newCategory === "none" || !newCategory ? null : newCategory,
        status,
        priority: "normal",
        submitted_by: user.id,
        assigned_to: assignedTo,
        send_to: effectiveSendTo,
        send_to_user_id: newSendToUserId,
      });

    setNewSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const submitterName = profile?.full_name ?? "Someone";
    if (isToHoussam) {
      const { getProfileIdsByNames } = await import("@/lib/user-lookup");
      const [laraId, samayaId] = await getProfileIdsByNames(["Lara", "Samaya"]);
      const assistantIds = [laraId, samayaId].filter(Boolean);
      if (assistantIds.length > 0) {
        await createNotificationsForUsers(
          assistantIds,
          "New request for review",
          `${submitterName} submitted a request to Houssam: "${newSubject.trim()}"`,
          `/requests`
        );
      }
    } else if (isDirectToOwner && sendTo) {
      const recipientId = newSendToUserId;
      if (recipientId) {
        await createNotification({
          userId: recipientId,
          title: "Request awaiting approval",
          message: `${submitterName} submitted a request: "${newSubject.trim()}"`,
          link: "/requests",
        });
      }
    } else {
      await createNotificationsForUsers(
        [newSendToUserId],
        "New request",
        `${submitterName} sent you a request: "${newSubject.trim()}"`,
        `/requests`
      );
    }

    toast.success("Request submitted");
    setNewSubject("");
    setNewDescription("");
    setNewCategory("none");
    setNewSendToUserId("");
    setNewOpen(false);
    fetchRequests();
  }

  async function handleForward(rid: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const req = requests.find((r) => r.id === rid);
    const subject = req?.subject ?? "A request";
    const assistantName = profile?.full_name ?? "An assistant";

    setActionSubmitting(true);
    const { error } = await supabase
      .from("requests")
      .update({
        status: "awaiting_approval",
        assigned_to: null,
        reviewed_by: user.id,
        priority: assistantPriority,
        assistant_notes: assistantNotes.trim() || null,
        forwarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rid);

    setActionSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const { getProfileIdsByNames } = await import("@/lib/user-lookup");
    const [houssamId, kareemId] = await getProfileIdsByNames(["Houssam", "Kareem"]);
    const ownerIds = [houssamId, kareemId].filter(Boolean);
    if (ownerIds.length > 0) {
      await createNotificationsForUsers(
        ownerIds,
        "New request awaiting approval",
        `New request awaiting your approval: "${subject}" — forwarded by ${assistantName}`,
        "/requests"
      );
    }

    toast.success("Request forwarded to Houssam and Kareem");
    setDetailOpen(null);
    setAssistantNotes("");
    setAssistantPriority("normal");
    fetchRequests();
  }

  async function handleApprove(rid: string) {
    const req = detailOpen ?? requests.find((r) => r.id === rid);
    const subject = req?.subject ?? "Your request";
    const submitterId = req?.submitted_by;
    const ownerName = profile?.full_name ?? "Management";

    setActionSubmitting(true);
    const { error } = await supabase
      .from("requests")
      .update({
        status: "approved",
        management_comments: managementComments.trim() || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rid);

    setActionSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (submitterId) {
      await createNotification({
        userId: submitterId,
        title: "Request approved",
        message: `Your request "${subject}" has been approved by ${ownerName}`,
        link: "/requests",
      });
    }
    toast.success("Request approved");
    setDetailOpen(null);
    setManagementComments("");
    fetchRequests();
  }

  async function handleReject(rid: string) {
    const req = detailOpen ?? requests.find((r) => r.id === rid);
    const subject = req?.subject ?? "Your request";
    const submitterId = req?.submitted_by;
    const ownerName = profile?.full_name ?? "Management";

    setActionSubmitting(true);
    const { error } = await supabase
      .from("requests")
      .update({
        status: "rejected",
        management_comments: managementComments.trim() || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rid);

    setActionSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (submitterId) {
      await createNotification({
        userId: submitterId,
        title: "Request rejected",
        message: `Your request "${subject}" has been rejected by ${ownerName}`,
        link: "/requests",
      });
    }
    toast.success("Request rejected");
    setDetailOpen(null);
    setManagementComments("");
    fetchRequests();
  }

  async function handleNeedsMoreInfo(rid: string) {
    const req = detailOpen ?? requests.find((r) => r.id === rid);
    const subject = req?.subject ?? "Your request";
    const submitterId = req?.submitted_by;
    const ownerName = profile?.full_name ?? "Management";

    setActionSubmitting(true);
    const { error } = await supabase
      .from("requests")
      .update({
        status: "needs_more_info",
        management_comments: managementComments.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rid);

    setActionSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (submitterId) {
      await createNotification({
        userId: submitterId,
        title: "More information requested",
        message: `More information requested on "${subject}" by ${ownerName}`,
        link: "/requests",
      });
    }
    toast.success("Request sent back for more information");
    setDetailOpen(null);
    setManagementComments("");
    fetchRequests();
  }

  function openDetail(r: RequestWithProfiles) {
    setDetailOpen(r);
    setAssistantNotes(r.assistant_notes ?? "");
    setAssistantPriority(r.priority);
    setManagementComments(r.management_comments ?? "");
  }

  const submitterName = (r: RequestWithProfiles) =>
    r.submitter?.full_name ?? "Unknown";
  const assigneeName = (r: RequestWithProfiles) =>
    r.assignee?.full_name ?? "—";
  const reviewerName = (r: RequestWithProfiles) =>
    r.reviewer?.full_name ?? "—";

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Request Center</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 size-5" />
          New Request
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="request-status-filter" className="h-10 w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(REQUEST_STATUS_LABELS)
              .filter(([k]) => k)
              .map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger id="request-priority-filter" className="h-10 w-[160px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
            <SelectItem value="normal">🟡 Medium</SelectItem>
            <SelectItem value="urgent">🔴 Urgent</SelectItem>
            {isRequestAssistant && (
              <SelectItem value="unlabeled">Unlabeled</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={sendToFilter} onValueChange={setSendToFilter}>
          <SelectTrigger id="request-send-to-filter" className="h-10 w-[140px]">
            <SelectValue placeholder="Send To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {uniqueSendToOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {uniqueSubmitters.length > 0 && (
          <Select
            value={submittedByFilter}
            onValueChange={setSubmittedByFilter}
          >
            <SelectTrigger id="request-submitted-by-filter" className="h-10 w-[160px]">
              <SelectValue placeholder="Submitted By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueSubmitters.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          type="date"
          value={dateFromFilter}
          onChange={(e) => setDateFromFilter(e.target.value)}
          className="h-10 w-[140px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateToFilter}
          onChange={(e) => setDateToFilter(e.target.value)}
          className="h-10 w-[140px]"
          placeholder="To"
        />
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "priority" | "status")}>
          <SelectTrigger id="request-sort-by" className="h-10 w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="priority">Sort by Priority</SelectItem>
            <SelectItem value="status">Sort by Status</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id="request-search"
          name="request-search"
          placeholder="Search subject, description, submitted by..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[200px] flex-1"
        />
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No requests found.</p>
          <Button className="mt-4" onClick={() => setNewOpen(true)}>
            New Request
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Sent To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(r)}
                >
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell>{submitterName(r)}</TableCell>
                  <TableCell>{getSendToLabel(r)}</TableCell>
                  <TableCell>
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={r.priority} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{assigneeName(r)}</TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Request</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitRequest();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Subject / Title *</Label>
              <Input
                id="request-subject"
                name="request-subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Short summary..."
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                id="request-description"
                name="request-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detailed explanation..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="request-category" className="mt-2">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {REQUEST_CATEGORIES.filter((c) => c).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Send To *</Label>
              <Select
                value={newSendToUserId}
                onValueChange={setNewSendToUserId}
                required
              >
                <SelectTrigger id="request-send-to" className="mt-2">
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {allProfiles
                    .filter((p) => p.id !== profile?.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-xs">
              Submitted by: {profile?.full_name ?? "You"} ·{" "}
              {new Date().toLocaleString()}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={newSubmitting}>
                {newSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailOpen}
        onOpenChange={(o) => !o && setDetailOpen(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailOpen?.subject}</DialogTitle>
          </DialogHeader>
          {detailOpen && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="mt-1 text-muted-foreground">
                  {detailOpen.description || "—"}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <p>
                    <Badge variant="secondary">
                      {REQUEST_STATUS_LABELS[detailOpen.status]}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label>Priority</Label>
                  <p>
                    <PriorityBadge priority={detailOpen.priority} />
                  </p>
                </div>
                <div>
                  <Label>Category</Label>
                  <p>{detailOpen.category || "—"}</p>
                </div>
                <div>
                  <Label>Submitted By</Label>
                  <p>{submitterName(detailOpen)}</p>
                </div>
                <div>
                  <Label>Sent To</Label>
                  <p>{getSendToLabel(detailOpen)}</p>
                </div>
                <div>
                  <Label>Date Submitted</Label>
                  <p>{new Date(detailOpen.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <Label>Assigned To</Label>
                  <p>{assigneeName(detailOpen)}</p>
                </div>
                {detailOpen.reviewed_by && (
                  <div>
                    <Label>Reviewed By</Label>
                    <p>{reviewerName(detailOpen)}</p>
                  </div>
                )}
              </div>
              {detailOpen.assistant_notes && (
                <div>
                  <Label>Assistant Notes</Label>
                  <p className="mt-1 text-muted-foreground">
                    {detailOpen.assistant_notes}
                  </p>
                </div>
              )}
              {detailOpen.management_comments && (
                <div>
                  <Label>Management Comments</Label>
                  <p className="mt-1 text-muted-foreground">
                    {detailOpen.management_comments}
                  </p>
                </div>
              )}

              {isRequestAssistant &&
                detailOpen.status === "submitted" && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Assistant Actions</h4>
                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={assistantPriority}
                        onValueChange={setAssistantPriority}
                      >
                        <SelectTrigger id="request-assistant-priority" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Medium</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        id="request-assistant-notes"
                        name="request-assistant-notes"
                        value={assistantNotes}
                        onChange={(e) => setAssistantNotes(e.target.value)}
                        placeholder="Context, recommendations..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => handleForward(detailOpen.id)}
                      disabled={actionSubmitting}
                    >
                      Forward to Management
                    </Button>
                  </div>
                )}

              {(isRequestManagement || isSamer || isKareem || isHoussam) &&
                detailOpen.status === "awaiting_approval" && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Management Actions</h4>
                    <div>
                      <Label>Comments (optional)</Label>
                      <Textarea
                        id="request-management-comments"
                        name="request-management-comments"
                        value={managementComments}
                        onChange={(e) => setManagementComments(e.target.value)}
                        placeholder="e.g. Approved but reduce budget to $500"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleApprove(detailOpen.id)}
                        disabled={actionSubmitting}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="mr-2 size-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(detailOpen.id)}
                        disabled={actionSubmitting}
                      >
                        <X className="mr-2 size-4" />
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleNeedsMoreInfo(detailOpen.id)}
                        disabled={actionSubmitting}
                      >
                        <MessageSquare className="mr-2 size-4" />
                        Request More Info
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
