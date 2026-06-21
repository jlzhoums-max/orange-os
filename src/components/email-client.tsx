"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  Command,
  CornerUpLeft,
  Inbox,
  Keyboard,
  Mail,
  MailCheck,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Tag,
  UserPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type InboxSplit = "All" | "Important" | "Needs Reply" | "Read Later" | "Snoozed" | "Follow Up" | "Tools" | "News";
type EmailActionLabel = "OrangeOS/Important" | "OrangeOS/Needs Reply" | "OrangeOS/Read Later" | "OrangeOS/News" | "OrangeOS/Tools";
type EmailMessageAction = "archive" | "unarchive" | "markRead" | "markUnread" | "label" | "snooze" | "unsnooze";

type SyncedEmail = {
  id: string;
  connectedAccountId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  gmailMessageId: string;
  threadId: string | null;
  split: InboxSplit;
  from: string;
  sender: string | null;
  subject: string;
  preview: string;
  receivedAt: string | null;
  labels: string[];
  unread: boolean;
  important: boolean;
  reminderAt: string | null;
  snoozeUntil: string | null;
};

type MailThread = {
  id: string;
  connectedAccountId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  gmailMessageId?: string;
  threadId?: string | null;
  split: InboxSplit;
  from: string;
  role: string;
  subject: string;
  preview: string;
  body: string[];
  time: string;
  unread: boolean;
  priority: "High" | "Normal" | "Low";
  readStatus: string;
  reminder: string;
  reminderAt: string | null;
  snoozeUntil: string | null;
  labels: string[];
  aiDraft: string;
};

type EmailStatus = {
  dueFollowUps: number;
  scheduledFollowUps: number;
  snoozed: number;
  dueSnoozed: number;
  recentRuns: Array<{
    trigger: string;
    status: string;
    gmail_count: number;
    error: string | null;
    started_at: string;
    completed_at: string | null;
  }>;
};

type GoogleAccountSummary = {
  id: string;
  account_email: string | null;
  display_name: string | null;
  is_primary: boolean;
};

type UndoAction = {
  action: Extract<EmailMessageAction, "unarchive" | "unsnooze" | "markRead" | "markUnread">;
  label: string;
  thread: MailThread;
};

type EmailMessageDetail = {
  body: string;
  headers: {
    from: string | null;
    to: string | null;
    subject: string | null;
    date: string | null;
    messageId: string | null;
  };
};

const splitIcons: Record<InboxSplit, LucideIcon> = {
  All: Inbox,
  Important: Zap,
  "Needs Reply": MessageSquare,
  "Read Later": Clock3,
  Snoozed: Clock3,
  "Follow Up": Bell,
  Tools: Tag,
  News: Inbox,
};

const commandItems = [
  "Archive thread",
  "Set reminder",
  "Insert snippet",
  "Summarize sender history",
  "Find calendar time",
  "Forward to task list",
];

function priorityFromEmail(email: SyncedEmail): MailThread["priority"] {
  const haystack = [email.subject, email.preview, ...email.labels].join(" ").toLowerCase();

  if (email.important || haystack.includes("important") || haystack.includes("urgent") || haystack.includes("action required")) return "High";
  if (haystack.includes("newsletter") || haystack.includes("promotion")) return "Low";
  return "Normal";
}

function formatMailTime(value: string | null) {
  if (!value) return "Recent";

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatReminder(value: string | null) {
  if (!value) return "No reminder set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No reminder set";

  return `Follow up ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

function formatSnooze(value: string | null) {
  if (!value) return "No snooze deadline";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No snooze deadline";

  return `Snoozed until ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

function isPastIso(value: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function defaultSnoozeLocalDateTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return dateTimeLocalFromIso(tomorrow.toISOString());
}

function dateTimeLocalFromIso(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function cleanSender(sender: string | null) {
  if (!sender) return "Unknown sender";
  return sender.replace(/\s*<.*?>\s*/g, "").replaceAll('"', "").trim() || sender;
}

function senderRole(sender: string | null) {
  const email = sender?.match(/<(.+?)>/)?.[1] ?? sender ?? "";
  return email.includes("@") ? email : "Synced Gmail";
}

function emailToThread(email: SyncedEmail): MailThread {
  const from = email.from || cleanSender(email.sender);
  const subject = email.subject?.trim() || "(No subject)";
  const preview = email.preview?.trim() || "No preview was synced for this message.";
  const labels = email.labels.filter(Boolean).slice(0, 4);

  return {
    id: email.id,
    connectedAccountId: email.connectedAccountId,
    accountEmail: email.accountEmail,
    accountName: email.accountName,
    gmailMessageId: email.gmailMessageId,
    threadId: email.threadId,
    split: email.split,
    from,
    role: senderRole(email.sender),
    subject,
    preview,
    body: [preview],
    time: formatMailTime(email.receivedAt),
    unread: email.unread,
    priority: priorityFromEmail(email),
    readStatus: email.unread ? "Unread in Gmail" : "Synced from Gmail",
    reminder: formatReminder(email.reminderAt),
    reminderAt: email.reminderAt,
    snoozeUntil: email.snoozeUntil,
    labels: labels.length ? labels : ["Gmail"],
    aiDraft: `Thanks for sending this over. I reviewed "${subject}" and will follow up with the next step shortly.`,
  };
}

function paragraphsFromBody(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function priorityClass(priority: MailThread["priority"]) {
  if (priority === "High") return "border-[#ff9b68]/55 bg-[#fff1e8] text-[#b9470f]";
  if (priority === "Low") return "border-[#e8d0bd] bg-[#fffaf4] text-[#8a6a52]";
  return "border-[#b8d8a3] bg-[#f3f9ea] text-[#58733d]";
}

export function EmailClient() {
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [accounts, setAccounts] = useState<GoogleAccountSummary[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("all");
  const [activeSplit, setActiveSplit] = useState<InboxSplit>("Important");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [reminder, setReminder] = useState("No reminder set");
  const [reminderAtInput, setReminderAtInput] = useState("");
  const [snoozeUntilInput, setSnoozeUntilInput] = useState(defaultSnoozeLocalDateTime);
  const [status, setStatus] = useState("Loading synced mail");
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<(EmailMessageDetail & { messageId: string }) | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [draftCreating, setDraftCreating] = useState(false);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [createdDraftAccountId, setCreatedDraftAccountId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [separating, setSeparating] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [lastUndo, setLastUndo] = useState<UndoAction | null>(null);

  const loadEmailStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/email/status", { cache: "no-store" });
      const payload = (await response.json()) as EmailStatus & { error?: string };

      if (response.ok) {
        setEmailStatus(payload);
      }
    } catch {
      setEmailStatus(null);
    }
  }, []);

  const loadMail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/email/threads", { cache: "no-store" });
      const payload = (await response.json()) as { accounts?: GoogleAccountSummary[]; threads?: SyncedEmail[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Email data could not be loaded.");
      }

      const nextThreads = (payload.threads ?? []).map(emailToThread);
      setAccounts(payload.accounts ?? []);
      setThreads(nextThreads);
      setSelectedId(nextThreads[0]?.id ?? null);
      setDraft(nextThreads[0]?.aiDraft ?? "");
      setReminder(nextThreads[0]?.reminder ?? "No reminder set");
      setReminderAtInput(dateTimeLocalFromIso(nextThreads[0]?.reminderAt ?? null));
      setSnoozeUntilInput(dateTimeLocalFromIso(nextThreads[0]?.snoozeUntil ?? null) || defaultSnoozeLocalDateTime());
      setStatus(nextThreads.length ? `Loaded ${nextThreads.length} synced email${nextThreads.length === 1 ? "" : "s"}` : "No synced mail yet");
      void loadEmailStatus();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Email data could not be loaded.");
      setThreads([]);
      setAccounts([]);
      setSelectedId(null);
      setDraft("");
      setReminderAtInput("");
      setSnoozeUntilInput(defaultSnoozeLocalDateTime());
      setStatus("Email connection needs attention");
    } finally {
      setLoading(false);
    }
  }, [loadEmailStatus]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadMail();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadMail]);

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null;
  const selectedMessageDetail =
    selectedThread?.gmailMessageId && messageDetail?.messageId === selectedThread.gmailMessageId
      ? messageDetail
      : null;

  useEffect(() => {
    if (!selectedThread?.gmailMessageId) {
      return;
    }

    let cancelled = false;
    const messageId = selectedThread.gmailMessageId;

    async function loadMessageDetail() {
      setMessageLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/email/messages/${messageId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as EmailMessageDetail & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Gmail message could not be loaded.");
        }

        if (!cancelled) {
          setMessageDetail({ ...payload, messageId });
        }
      } catch (detailError) {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : "Gmail message could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setMessageLoading(false);
        }
      }
    }

    void loadMessageDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedThread?.gmailMessageId]);

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesAccount = activeAccountId === "all" || thread.connectedAccountId === activeAccountId;
      if (!matchesAccount) return false;

      const matchesSplit =
        activeSplit === "All"
          ? true
          : activeSplit === "Important"
            ? thread.priority === "High" || thread.split === "Important"
            : activeSplit === "Follow Up"
              ? isPastIso(thread.reminderAt)
              : thread.split === activeSplit;

      if (!matchesSplit) return false;
      if (!normalizedQuery) return true;

      return [thread.from, thread.subject, thread.preview, thread.labels.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeAccountId, activeSplit, query, threads]);

  function selectThread(thread: MailThread) {
    setSelectedId(thread.id);
    setDraft(thread.aiDraft);
    setReminder(thread.reminder);
    setReminderAtInput(dateTimeLocalFromIso(thread.reminderAt));
    setSnoozeUntilInput(dateTimeLocalFromIso(thread.snoozeUntil) || defaultSnoozeLocalDateTime());
    setCreatedDraftId(null);
    setCreatedDraftAccountId(null);
    setStatus("Ready");
  }

  async function syncMail() {
    setSyncing(true);
    setStatus("Syncing Gmail");
    setError(null);

    try {
      const response = await fetch("/api/email/threads", { method: "POST" });
      const payload = (await response.json()) as { synced?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Gmail sync failed.");
      }

      setStatus(`Synced ${payload.synced ?? 0} email${payload.synced === 1 ? "" : "s"}`);
      await loadMail();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Gmail sync failed.");
      setStatus("Email sync needs attention");
    } finally {
      setSyncing(false);
    }
  }

  async function separateMail() {
    setSeparating(true);
    setStatus("Separating inbox");
    setError(null);

    try {
      const response = await fetch("/api/email/separate", { method: "POST" });
      const payload = (await response.json()) as { categorized?: number; failed?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Email separator failed.");
      }

      setStatus(`Separated ${payload.categorized ?? 0} emails${payload.failed ? `, ${payload.failed} failed` : ""}`);
      await loadMail();
    } catch (separatorError) {
      setError(separatorError instanceof Error ? separatorError.message : "Email separator failed.");
      setStatus("Separator needs attention");
    } finally {
      setSeparating(false);
    }
  }

  function useAiDraft() {
    if (!selectedThread) return;
    setDraft(selectedThread.aiDraft);
    setStatus("AI draft inserted");
  }

  async function createDraft() {
    if (!selectedThread?.gmailMessageId) {
      setStatus("Draft queued locally");
      return;
    }

    setDraftCreating(true);
    setCreatedDraftId(null);
    setError(null);

    try {
      const response = await fetch("/api/email/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: draft,
          messageId: selectedThread.gmailMessageId,
        }),
      });
      const payload = (await response.json()) as { connectedAccountId?: string | null; draftId?: string; error?: string };

      if (!response.ok || !payload.draftId) {
        throw new Error(payload.error ?? "Gmail draft could not be created.");
      }

      setCreatedDraftId(payload.draftId);
      setCreatedDraftAccountId(payload.connectedAccountId ?? null);
      setStatus("Gmail draft created");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Gmail draft could not be created.");
      setStatus("Draft needs attention");
    } finally {
      setDraftCreating(false);
    }
  }

  async function runMessageAction(
    action: EmailMessageAction,
    label?: EmailActionLabel,
    targetThread = selectedThread,
    isUndo = false,
  ) {
    if (!targetThread?.gmailMessageId) {
      setStatus("Sync Gmail before running message actions");
      return;
    }

    setActing(true);
    setError(null);

    try {
      const response = await fetch(`/api/email/messages/${targetThread.gmailMessageId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          label,
          snoozeUntil: action === "snooze" && snoozeUntilInput ? new Date(snoozeUntilInput).toISOString() : undefined,
        }),
      });
      const payload = (await response.json()) as { labels?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Gmail action failed.");
      }

      if (action === "archive" || action === "snooze") {
        setThreads((current) => current.filter((thread) => thread.id !== targetThread.id));
        const nextThread = threads.find((thread) => thread.id !== targetThread.id) ?? null;
        setSelectedId(nextThread?.id ?? null);
        setDraft(nextThread?.aiDraft ?? "");
        setReminder(nextThread?.reminder ?? "No reminder set");
        setReminderAtInput(dateTimeLocalFromIso(nextThread?.reminderAt ?? null));
        setStatus(action === "archive" ? "Archived in Gmail" : "Snoozed out of Inbox");
        setLastUndo(
          isUndo
            ? null
            : {
                action: action === "archive" ? "unarchive" : "unsnooze",
                label: action === "archive" ? "Undo archive" : "Undo snooze",
                thread: targetThread,
              },
        );
        void loadEmailStatus();
        return;
      }

      if (action === "unarchive" || action === "unsnooze") {
        const restoredThread =
          action === "unsnooze"
            ? {
                ...targetThread,
                split: "Read Later" as InboxSplit,
                labels: targetThread.labels.filter((threadLabel) => threadLabel !== "OrangeOS/Snoozed"),
                snoozeUntil: null,
              }
            : targetThread;

        setThreads((current) =>
          current.some((thread) => thread.id === restoredThread.id) ? current : [restoredThread, ...current],
        );
        setSelectedId(restoredThread.id);
        setDraft(restoredThread.aiDraft);
        setReminder(restoredThread.reminder);
        setReminderAtInput(dateTimeLocalFromIso(restoredThread.reminderAt));
        setSnoozeUntilInput(dateTimeLocalFromIso(restoredThread.snoozeUntil) || defaultSnoozeLocalDateTime());
        setStatus(action === "unarchive" ? "Archive undone" : "Snooze undone");
        setLastUndo(null);
        void loadEmailStatus();
        return;
      }

      if (action === "label" && label) {
        const nextSplit = label.replace("OrangeOS/", "") as InboxSplit;
        setThreads((current) =>
          current.map((thread) =>
            thread.id === targetThread.id
              ? {
                  ...thread,
                  labels: Array.from(new Set([...thread.labels, label])).slice(0, 4),
                  priority: label === "OrangeOS/Important" ? "High" : thread.priority,
                  split: nextSplit,
                }
              : thread,
          ),
        );
        setStatus(`Labeled ${nextSplit}`);
        void loadEmailStatus();
        return;
      }

      const labels = payload.labels ?? [];
      const unread = labels.includes("UNREAD");
      setThreads((current) =>
        current.map((thread) =>
          thread.id === targetThread.id
            ? {
                ...thread,
                labels: labels.length ? labels.slice(0, 4) : ["Gmail"],
                readStatus: unread ? "Unread in Gmail" : "Synced from Gmail",
                unread,
              }
            : thread,
        ),
      );
      setStatus(action === "markRead" ? "Marked read in Gmail" : "Marked unread in Gmail");
      void loadEmailStatus();
      setLastUndo(
        isUndo
          ? null
          : {
              action: action === "markRead" ? "markUnread" : "markRead",
              label: action === "markRead" ? "Undo mark read" : "Undo mark unread",
              thread: targetThread,
            },
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Gmail action failed.");
      setStatus("Message action needs attention");
    } finally {
      setActing(false);
    }
  }

  async function undoLastMessageAction() {
    if (!lastUndo) return;
    await runMessageAction(lastUndo.action, undefined, lastUndo.thread, true);
  }

  async function saveReminder(nextReminderAt: string | null) {
    if (!selectedThread?.gmailMessageId) {
      setStatus("Select a synced Gmail message first");
      return;
    }

    setActing(true);
    setError(null);

    try {
      const response = await fetch(`/api/email/messages/${selectedThread.gmailMessageId}/reminder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reminderAt: nextReminderAt }),
      });
      const payload = (await response.json()) as { reminderAt?: string | null; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Reminder could not be saved.");
      }

      const reminderAt = payload.reminderAt ?? null;
      const reminderLabel = formatReminder(reminderAt);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === selectedThread.id
            ? {
                ...thread,
                reminder: reminderLabel,
                reminderAt,
              }
            : thread,
        ),
      );
      setReminder(reminderLabel);
      setReminderAtInput(dateTimeLocalFromIso(reminderAt));
      setStatus(reminderAt ? "Follow-up reminder saved" : "Follow-up reminder cleared");
      void loadEmailStatus();
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : "Reminder could not be saved.");
      setStatus("Reminder needs attention");
    } finally {
      setActing(false);
    }
  }

  function archiveThread() {
    void runMessageAction("archive");
  }

  async function sendConfirmedDraft() {
    if (!createdDraftId || !sendConfirm) {
      return;
    }

    setSendingDraft(true);
    setError(null);

    try {
      const response = await fetch("/api/email/drafts/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm: true,
          connectedAccountId: createdDraftAccountId,
          draftId: createdDraftId,
        }),
      });
      const payload = (await response.json()) as { messageId?: string; error?: string };

      if (!response.ok || !payload.messageId) {
        throw new Error(payload.error ?? "Gmail draft could not be sent.");
      }

      setCreatedDraftId(null);
      setCreatedDraftAccountId(null);
      setSendConfirm(false);
      setStatus("Sent from Gmail");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gmail draft could not be sent.");
      setStatus("Send needs attention");
    } finally {
      setSendingDraft(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[#f2c9a9] bg-[#fff4e6] text-[#2a170d] shadow-[0_24px_80px_rgba(166,88,24,0.16)]">
      <div className="flex min-h-[820px] flex-col xl:grid xl:grid-cols-[4.5rem_minmax(18rem,24rem)_minmax(32rem,1fr)] 2xl:grid-cols-[4.5rem_minmax(18rem,24rem)_minmax(0,1fr)_21rem]">
        <CommandRail status={status} />

        <aside className="border-b border-[#f0c9a9] bg-[#fff7ed] xl:border-b-0 xl:border-r">
          <div className="border-b border-[#f0c9a9] p-4">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ff6b1a] px-4 text-sm font-bold text-white shadow-[0_16px_26px_rgba(255,107,26,0.24)] hover:bg-[#ff7d33] disabled:cursor-wait disabled:opacity-70"
              disabled={syncing}
              onClick={syncMail}
              type="button"
            >
              <RefreshCcw size={17} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing" : "Sync mail"}
            </button>
            <button
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#edc9ac] bg-white px-4 text-sm font-bold text-[#df5a12] hover:bg-[#fff0df] disabled:cursor-wait disabled:opacity-70"
              disabled={separating}
              onClick={separateMail}
              type="button"
            >
              <Sparkles size={16} className={separating ? "animate-pulse" : ""} />
              {separating ? "Separating..." : "Run separator"}
            </button>
            <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-[#edc9ac] bg-white px-3 text-sm text-[#3b2416] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <Search size={16} className="text-[#a97958]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#b28d73]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search synced mail..."
                type="search"
                value={query}
              />
              <Command size={13} className="text-[#a97958]" />
            </label>
          </div>

          <div className="border-b border-[#f0c9a9] p-3">
            <div className="grid gap-2">
              <button
                className={`rounded-lg px-3 py-2 text-left text-xs font-bold ${
                  activeAccountId === "all" ? "bg-[#ff6b1a] text-white" : "border border-[#edc9ac] bg-white text-[#6f4a32] hover:bg-[#fff0df]"
                }`}
                onClick={() => setActiveAccountId("all")}
                type="button"
              >
                All accounts
              </button>
              {accounts.map((account) => (
                <button
                  className={`rounded-lg px-3 py-2 text-left text-xs font-bold ${
                    activeAccountId === account.id ? "bg-[#ff6b1a] text-white" : "border border-[#edc9ac] bg-white text-[#6f4a32] hover:bg-[#fff0df]"
                  }`}
                  key={account.id}
                  onClick={() => setActiveAccountId(account.id)}
                  type="button"
                >
                  {account.display_name ?? account.account_email ?? "Google account"}
                </button>
              ))}
              <a
                className="rounded-lg border border-dashed border-[#edc9ac] bg-white px-3 py-2 text-center text-xs font-bold text-[#df5a12] hover:bg-[#fff0df]"
                href="/api/integrations/google/connect?next=/email"
              >
                Connect Google account
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5 xl:grid-cols-1">
            {(Object.keys(splitIcons) as InboxSplit[]).map((split) => {
              const Icon = splitIcons[split];
              const countedThreads = activeAccountId === "all" ? threads : threads.filter((thread) => thread.connectedAccountId === activeAccountId);
              const count =
                split === "All"
                  ? countedThreads.length
                  : split === "Important"
                    ? countedThreads.filter((thread) => thread.priority === "High" || thread.split === "Important").length
                    : split === "Follow Up"
                      ? countedThreads.filter((thread) => isPastIso(thread.reminderAt)).length
                      : countedThreads.filter((thread) => thread.split === split).length;
              const isActive = activeSplit === split;

              return (
                <button
                  className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#ff6b1a] text-white shadow-[0_10px_22px_rgba(255,107,26,0.18)]"
                      : "border border-transparent text-[#7a5a42] hover:border-[#f0c9a9] hover:bg-white hover:text-[#df5a12]"
                  }`}
                  key={split}
                  onClick={() => setActiveSplit(split)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={16} className={isActive ? "text-white" : "text-[#b2764a]"} />
                    <span className="truncate">{split}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-[#fff1e9] text-[#e85d11]" : "bg-[#ffecd9] text-[#9a6747]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#f0c9a9]">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => (
                <button
                  className={`block w-full border-b border-[#f0d4bd] px-4 py-4 text-left transition ${
                    selectedThread?.id === thread.id ? "bg-white shadow-[inset_3px_0_0_#ff6b1a]" : "hover:bg-white/70"
                  }`}
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {thread.unread ? <span className="h-2 w-2 rounded-full bg-[#ff6b1a]" /> : null}
                        <p className="truncate text-sm font-bold text-[#2a170d]">{thread.from}</p>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-semibold text-[#4b2f1f]">{thread.subject}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[#9f7659]">{thread.time}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#7a5a42]">{thread.preview}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {thread.gmailMessageId ? (
                      <span className="rounded-full bg-[#ecffe3] px-2 py-0.5 text-[11px] font-semibold text-[#58733d]">
                        Gmail
                      </span>
                    ) : null}
                    {thread.accountEmail ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#8c5f3d]">
                        {thread.accountEmail}
                      </span>
                    ) : null}
                    {thread.reminderAt ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isPastIso(thread.reminderAt) ? "bg-[#ffe3d2] text-[#b9470f]" : "bg-[#fff7cc] text-[#8a6a12]"}`}>
                        {isPastIso(thread.reminderAt) ? "Due now" : thread.reminder}
                      </span>
                    ) : null}
                    {thread.snoozeUntil ? (
                      <span className="rounded-full bg-[#f1edff] px-2 py-0.5 text-[11px] font-semibold text-[#65529d]">
                        {formatSnooze(thread.snoozeUntil)}
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(thread.priority)}`}>
                      {thread.priority}
                    </span>
                    {thread.labels.slice(0, 2).map((label) => (
                      <span className="rounded-full bg-[#fff0df] px-2 py-0.5 text-[11px] text-[#8c5f3d]" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-5 text-sm leading-6 text-[#7a5a42]">
                {loading ? "Loading synced mail..." : error ?? "No synced mail yet. Use Sync mail after Google is connected."}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-[#fffaf4] text-[#2a170d]">
          <div className="sticky top-0 z-10 border-b border-[#efd1ba] bg-[#fffaf4]/92 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ff6b1a]">Orange OS Mail</p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-normal text-[#2a170d] sm:text-2xl">
                  {selectedThread?.subject ?? "Synced Gmail"}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <MailAction icon={Archive} label={acting ? "Working" : "Archive"} onClick={archiveThread} disabled={!selectedThread || acting} />
                <MailAction icon={Clock3} label="Remind" onClick={() => setStatus(reminder)} disabled={!selectedThread || acting} />
                <MailAction icon={CornerUpLeft} label="Reply" onClick={useAiDraft} variant="primary" disabled={!selectedThread || acting} />
                <MailAction
                  icon={CornerUpLeft}
                  label={lastUndo?.label ?? "Undo"}
                  onClick={() => void undoLastMessageAction()}
                  disabled={!lastUndo || acting}
                />
              </div>
            </div>
          </div>

          <article className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
            <div className="rounded-lg border border-[#efd1ba] bg-white shadow-[0_12px_30px_rgba(166,88,24,0.08)]">
              {selectedThread ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-[#f1d8c3] p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ff6b1a] text-sm font-bold text-white">
                        {selectedThread.from.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#2a170d]">{selectedThread.from}</p>
                        <p className="text-sm text-[#7a5a42]">{selectedThread.role}</p>
                        <p className="mt-2 text-sm text-[#6f4a32]">To Justin Zhou</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#7a5a42]">
                      <span>{selectedThread.time}</span>
                      <button className="rounded-full p-2 text-[#7a5a42] hover:bg-[#fff0df]" aria-label="More actions" type="button">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 text-[15px] leading-7 text-[#3b2416] sm:p-7">
                    {messageLoading ? <p>Loading full message from Gmail...</p> : null}
                    {(selectedMessageDetail?.body ? paragraphsFromBody(selectedMessageDetail.body) : selectedThread.body).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="border-t border-[#f1d8c3] bg-[#fff8ef] p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                      {selectedThread.labels.map((label) => (
                        <span className="rounded-full bg-[#fff1e9] px-3 py-1 text-xs font-bold text-[#d85d13]" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-7 text-sm leading-6 text-[#7a5a42]">
                  {error ?? "No synced Gmail messages are available yet. Use Sync mail to refresh from Google."}
                </div>
              )}
            </div>

            <section className="mt-4 rounded-lg border border-[#efd1ba] bg-white shadow-[0_12px_30px_rgba(166,88,24,0.07)]">
              <div className="flex items-center justify-between border-b border-[#f1d8c3] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#2a170d]">
                  <Sparkles size={17} className="text-[#ff6b1a]" />
                  AI reply
                </div>
                <button
                  className="rounded-full border border-[#ffd0b8] bg-[#fff7f2] px-3 py-1.5 text-xs font-bold text-[#d85d13] hover:bg-[#ffeadf] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedThread}
                  onClick={useAiDraft}
                  type="button"
                >
                  Rewrite
                </button>
              </div>
              <textarea
                className="min-h-32 w-full resize-y rounded-b-lg bg-white p-4 text-sm leading-6 text-[#3b2416] outline-none disabled:bg-[#fff8ef]"
                disabled={!selectedThread}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Select a synced email to draft a reply."
                value={draft}
              />
              <div className="flex flex-col gap-3 border-t border-[#f1d8c3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-[#7a5a42]">
                  Creates a Gmail draft only. Sending still happens from Gmail for now.
                </p>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#ff6b1a] px-4 text-sm font-bold text-white hover:bg-[#ff7d33] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedThread || draftCreating}
                  onClick={createDraft}
                  type="button"
                >
                  <Send size={15} />
                  {draftCreating ? "Creating..." : selectedThread?.gmailMessageId ? "Create Gmail draft" : "Queue reply"}
                </button>
              </div>
              {createdDraftId ? (
                <div className="border-t border-[#f1d8c3] px-4 py-3">
                  <p className="text-xs font-semibold text-[#58733d]">Draft created in Gmail: {createdDraftId}</p>
                  <label className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-[#6f4a32]">
                    <input
                      checked={sendConfirm}
                      className="mt-1"
                      onChange={(event) => setSendConfirm(event.target.checked)}
                      type="checkbox"
                    />
                    I reviewed this draft and want Orange OS to send it from Gmail.
                  </label>
                  <button
                    className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#2a170d] px-4 text-xs font-bold text-white hover:bg-[#4b2f1f] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!sendConfirm || sendingDraft}
                    onClick={sendConfirmedDraft}
                    type="button"
                  >
                    <Send size={14} />
                    {sendingDraft ? "Sending..." : "Send confirmed draft"}
                  </button>
                </div>
              ) : null}
            </section>
          </article>
        </main>

        <aside className="border-t border-[#f0c9a9] bg-[#fff7ed] p-4 xl:col-span-3 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
          <div className="grid gap-3">
            <AssistantCard icon={Sparkles} title="AI summary">
              <p className="text-sm leading-6 text-[#6f4a32]">
                {selectedThread
                  ? `This live Gmail thread is about "${selectedThread.subject}". The reply button creates a Gmail draft for review.`
                  : "Sync Gmail to populate live message context for summaries and drafts."}
              </p>
            </AssistantCard>

            <AssistantCard icon={Bell} title="Follow-up">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-[#3b2416]">{reminder}</p>
                <input
                  className="h-10 w-full rounded-lg border border-[#edc9ac] bg-white px-3 text-sm text-[#3b2416] outline-none focus:border-[#ff6b1a] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedThread || acting}
                  onChange={(event) => setReminderAtInput(event.target.value)}
                  type="datetime-local"
                  value={reminderAtInput}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-lg bg-[#ff6b1a] px-3 py-2 text-xs font-bold text-white hover:bg-[#ff7d33] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || !reminderAtInput || acting}
                    onClick={() => void saveReminder(new Date(reminderAtInput).toISOString())}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="rounded-lg border border-[#edc9ac] bg-white px-3 py-2 text-xs font-bold text-[#6f4a32] hover:bg-[#fff0df] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || !selectedThread.reminderAt || acting}
                    onClick={() => void saveReminder(null)}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </AssistantCard>

            <AssistantCard icon={MailCheck} title="Read status">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#3b2416]">
                  <CheckCheck size={16} className="text-[#6f8f4e]" />
                  {selectedThread?.readStatus ?? "No message selected"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-[#edc9ac] bg-white px-3 py-1.5 text-xs font-bold text-[#6f4a32] hover:bg-[#fff0df] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || acting || !selectedThread.unread}
                    onClick={() => void runMessageAction("markRead")}
                    type="button"
                  >
                    Mark read
                  </button>
                  <button
                    className="rounded-full border border-[#edc9ac] bg-white px-3 py-1.5 text-xs font-bold text-[#6f4a32] hover:bg-[#fff0df] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || acting || selectedThread.unread}
                    onClick={() => void runMessageAction("markUnread")}
                    type="button"
                  >
                    Mark unread
                  </button>
                </div>
              </div>
            </AssistantCard>

            <AssistantCard icon={Tag} title="Triage actions">
              <div className="grid gap-2">
                {([
                  ["Important", "OrangeOS/Important"],
                  ["Needs Reply", "OrangeOS/Needs Reply"],
                  ["Read Later", "OrangeOS/Read Later"],
                  ["News", "OrangeOS/News"],
                  ["Tools", "OrangeOS/Tools"],
                ] as Array<[string, EmailActionLabel]>).map(([label, value]) => (
                  <button
                    className="rounded-lg border border-[#edc9ac] bg-white px-3 py-2 text-left text-xs font-bold text-[#6f4a32] hover:bg-[#fff0df] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || acting}
                    key={value}
                    onClick={() => void runMessageAction("label", value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
                <label className="grid gap-1 text-xs font-bold text-[#6f4a32]">
                  Snooze until
                  <input
                    className="h-10 rounded-lg border border-[#edc9ac] bg-white px-3 text-sm font-semibold text-[#3b2416] outline-none focus:border-[#ff6b1a] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedThread?.gmailMessageId || acting}
                    onChange={(event) => setSnoozeUntilInput(event.target.value)}
                    type="datetime-local"
                    value={snoozeUntilInput}
                  />
                </label>
                <button
                  className="rounded-lg border border-[#edc9ac] bg-[#fff0df] px-3 py-2 text-left text-xs font-bold text-[#df5a12] hover:bg-[#ffe0c2] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedThread?.gmailMessageId || !snoozeUntilInput || acting}
                  onClick={() => void runMessageAction("snooze")}
                  type="button"
                >
                  Snooze out of Inbox
                </button>
              </div>
            </AssistantCard>

            <AssistantCard icon={RefreshCcw} title="Mail health">
              <div className="grid gap-3 text-sm text-[#6f4a32]">
                <div className="grid grid-cols-2 gap-2">
                  <StatusPill label="Due" value={emailStatus?.dueFollowUps ?? 0} />
                  <StatusPill label="Snoozed" value={emailStatus?.snoozed ?? 0} />
                  <StatusPill label="Wakeups" value={emailStatus?.dueSnoozed ?? 0} />
                  <StatusPill label="Scheduled" value={emailStatus?.scheduledFollowUps ?? 0} />
                </div>
                {emailStatus?.recentRuns?.[0] ? (
                  <div className="rounded-lg border border-[#edc9ac] bg-white px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#a97958]">Latest sync</p>
                    <p className="mt-1 font-semibold text-[#3b2416]">
                      {emailStatus.recentRuns[0].status} · {emailStatus.recentRuns[0].gmail_count} Gmail
                    </p>
                    <p className="mt-1 text-xs text-[#8a6a52]">
                      {formatMailTime(emailStatus.recentRuns[0].completed_at ?? emailStatus.recentRuns[0].started_at)}
                    </p>
                    {emailStatus.recentRuns[0].error ? (
                      <p className="mt-2 text-xs font-semibold text-[#b9470f]">{emailStatus.recentRuns[0].error}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </AssistantCard>

            <AssistantCard icon={MessageSquare} title="Team notes">
              <div className="space-y-3">
                {["Convert selected message into a task.", "Attach relevant context to a project."].map((note) => (
                  <label className="flex items-start gap-2 text-sm text-[#6f4a32]" key={note}>
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#ff8a4c]/50 text-[#ff8a4c]">
                      <Check size={11} />
                    </span>
                    {note}
                  </label>
                ))}
              </div>
            </AssistantCard>

            <AssistantCard icon={Keyboard} title="Shortcuts">
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#6f4a32]">
                {commandItems.slice(0, 4).map((item, index) => (
                  <button
                    className="rounded-lg border border-[#edc9ac] bg-white px-2 py-2 text-left hover:border-[#ff6b1a]/45 hover:bg-[#fff0df] hover:text-[#df5a12]"
                    key={item}
                    onClick={() => setStatus(item)}
                    type="button"
                  >
                    <span className="mr-2 text-[#ff9b68]">{index + 1}</span>
                    {item}
                  </button>
                ))}
              </div>
            </AssistantCard>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CommandRail({ status }: { status: string }) {
  const items = [Inbox, Search, Sparkles, CalendarDays, UserPlus, Bell, MoreHorizontal];

  return (
    <aside className="flex items-center justify-between gap-2 border-b border-[#f0c9a9] bg-[#ffead7] px-3 py-3 xl:flex-col xl:border-b-0 xl:border-r xl:px-0 xl:py-4">
      <div className="flex items-center gap-2 xl:flex-col">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b1a] text-white shadow-[0_14px_26px_rgba(255,107,26,0.22)]">
          <Mail size={19} />
        </div>
        <div className="hidden h-px w-8 bg-[#eebf9b] xl:block" />
        {items.map((Icon, index) => (
          <button
            aria-label={`Mail command ${index + 1}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9a6747] hover:bg-white hover:text-[#df5a12]"
            key={index}
            type="button"
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <div className="hidden max-w-14 -rotate-90 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a6747] xl:block">
        {status}
      </div>
      <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#eebf9b] bg-white/50 text-[#9a6747] hover:text-[#df5a12]" aria-label="New command" type="button">
        <Plus size={17} />
      </button>
    </aside>
  );
}

function MailAction({
  icon: Icon,
  label,
  onClick,
  variant = "secondary",
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "primary"
          ? "bg-[#ff6b1a] text-white hover:bg-[#ff7d33]"
          : "border border-[#edc9ac] bg-white text-[#6f4a32] hover:bg-[#fff0df] hover:text-[#df5a12]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function AssistantCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#edc9ac] bg-white p-4 shadow-[0_10px_24px_rgba(166,88,24,0.05)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2a170d]">
        <Icon size={16} className="text-[#ff8a4c]" />
        {title}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#edc9ac] bg-white px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#a97958]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#3b2416]">{value}</p>
    </div>
  );
}
