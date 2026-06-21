"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  CornerUpLeft,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

type InboxMode = "Important" | "Other";
type InboxFilter = "all" | string;

type SyncedEmail = {
  gmail_message_id?: string | null;
  thread_id?: string | null;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  labels: string[] | null;
  account_email?: string | null;
};

type ConnectedInbox = {
  provider: string;
  email: string | null;
};

type MailThread = {
  id: string;
  gmailMessageId: string | null;
  from: string;
  initials: string;
  role: string;
  subject: string;
  preview: string;
  body: string[];
  time: string;
  unread: boolean;
  priority: "High" | "Normal" | "Low";
  readStatus: string;
  labels: string[];
  aiDraft: string;
  inbox: string;
  inboxLabel: string;
};

const seedThreads: MailThread[] = [
  {
    id: "seed-fn",
    gmailMessageId: null,
    from: "First National Lender",
    initials: "FN",
    role: "rates@firstnational.com",
    subject: "Rate lock expires Monday",
    preview: "Confirm whether you'd like to lock at 6.1% for 60 days before Monday at 5 PM.",
    body: [
      "Hi Ju,",
      "Following up on the refinance application for 14 Maple Street. We're able to offer a rate lock at 6.1% APR for a 60-day window, which would cover your expected closing date.",
      "Given current market movement, we'd recommend confirming by Monday at 5:00 PM to secure this rate. After that, pricing will be re-quoted at prevailing rates.",
      "Just reply to this message to confirm, and I'll send the lock paperwork right over.",
    ],
    time: "9:12a",
    unread: true,
    priority: "High",
    readStatus: "Unread",
    labels: ["Important", "Real Estate"],
    aiDraft: "Thanks Marcus - please lock the 6.1% APR for the 60-day window and send the paperwork over.",
    inbox: "personal@juos.local",
    inboxLabel: "Personal",
  },
  {
    id: "seed-da",
    gmailMessageId: null,
    from: "Dana · Contractor",
    initials: "DA",
    role: "dana@contracting.co",
    subject: "Tile samples for the walkthrough",
    preview: "Bringing three options by this morning so we can decide during the walkthrough.",
    body: ["Morning Ju - I will bring three tile options to the Maple St walkthrough so we can make a decision on site."],
    time: "8:40a",
    unread: true,
    priority: "High",
    readStatus: "Unread",
    labels: ["Real Estate"],
    aiDraft: "Perfect, bring all three options and any price differences so we can decide during the walkthrough.",
    inbox: "projects@juos.local",
    inboxLabel: "Projects",
  },
  {
    id: "seed-hi",
    gmailMessageId: null,
    from: "Home Insurance Co.",
    initials: "HI",
    role: "billing@homeinsurance.example",
    subject: "Your quarterly premium is due",
    preview: "A payment of $2,400 is due by June 21 to keep the policy active.",
    body: ["Your quarterly premium payment of $2,400 is due by June 21. Please pay before the end of the day to keep your policy active."],
    time: "Yest",
    unread: true,
    priority: "High",
    readStatus: "Unread",
    labels: ["Finance"],
    aiDraft: "Thanks - I will take care of the quarterly premium today.",
    inbox: "personal@juos.local",
    inboxLabel: "Personal",
  },
  {
    id: "seed-sr",
    gmailMessageId: null,
    from: "Sam Rivera",
    initials: "SR",
    role: "sam@example.com",
    subject: "Dinner still on for tonight?",
    preview: "Booked us a table at Bartaco for 6:30 - see you there?",
    body: ["Booked us a table at Bartaco for 6:30. Let me know if that still works."],
    time: "Yest",
    unread: false,
    priority: "Normal",
    readStatus: "Synced",
    labels: ["Personal"],
    aiDraft: "Yes, 6:30 works. See you there.",
    inbox: "personal@juos.local",
    inboxLabel: "Personal",
  },
  {
    id: "seed-oa",
    gmailMessageId: null,
    from: "Oak Ave HOA",
    initials: "OA",
    role: "hoa@oakave.example",
    subject: "Approved: exterior paint request",
    preview: "Your submitted color palette has been approved for the Oak Ave exterior.",
    body: ["Your exterior paint request for Oak Ave has been approved. Please keep a copy of this approval with your project records."],
    time: "Thu",
    unread: false,
    priority: "Normal",
    readStatus: "Synced",
    labels: ["Real Estate"],
    aiDraft: "Thanks for the approval. I will keep this on file with the project records.",
    inbox: "projects@juos.local",
    inboxLabel: "Projects",
  },
];

function priorityFromEmail(email: SyncedEmail): MailThread["priority"] {
  const haystack = [email.subject, email.snippet, ...(email.labels ?? [])].join(" ").toLowerCase();
  if (haystack.includes("important") || haystack.includes("urgent") || haystack.includes("action required")) return "High";
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

function cleanSender(sender: string | null) {
  if (!sender) return "Unknown sender";
  return sender.replace(/\s*<.*?>\s*/g, "").replaceAll('"', "").trim() || sender;
}

function senderRole(sender: string | null) {
  const email = sender?.match(/<(.+?)>/)?.[1] ?? sender ?? "";
  return email.includes("@") ? email : "Synced Gmail";
}

function initialsFromSender(sender: string) {
  const parts = sender.split(/\s|·/).filter(Boolean);
  return (parts[0]?.[0] ?? "M").concat(parts[1]?.[0] ?? "").toUpperCase().slice(0, 2);
}

function inboxLabel(email: string | null | undefined) {
  if (!email) return "Gmail";
  const [name] = email.split("@");
  if (!name) return email;
  return name
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || email;
}

function emailToThread(email: SyncedEmail, index: number): MailThread {
  const from = cleanSender(email.sender);
  const subject = email.subject?.trim() || "(No subject)";
  const preview = email.snippet?.trim() || "No preview was synced for this message.";
  const labels = email.labels?.filter(Boolean).slice(0, 4) ?? [];
  const unread = labels.some((label) => label.toLowerCase() === "unread");
  const inbox = email.account_email ?? "gmail";

  return {
    id: email.gmail_message_id ?? `${email.received_at ?? "email"}-${index}`,
    gmailMessageId: email.gmail_message_id ?? null,
    from,
    initials: initialsFromSender(from),
    role: senderRole(email.sender),
    subject,
    preview,
    body: [preview],
    time: formatMailTime(email.received_at),
    unread,
    priority: priorityFromEmail(email),
    readStatus: unread ? "Unread" : "Synced",
    labels: labels.length ? labels : ["Gmail"],
    aiDraft: `Draft a concise reply to "${subject}" after I review the full context.`,
    inbox,
    inboxLabel: inboxLabel(inbox),
  };
}

function avatarClass(index: number, selected?: boolean) {
  if (selected || index === 0) return "bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-white";
  if (index % 3 === 1) return "bg-[#3E9E66] text-white";
  if (index % 3 === 2) return "bg-[#C9A14A] text-white";
  return "bg-[#8C8475] text-white";
}

export function EmailClient() {
  const [threads, setThreads] = useState<MailThread[]>(seedThreads);
  const [usingSeed, setUsingSeed] = useState(true);
  const [mode, setMode] = useState<InboxMode>("Important");
  const [selectedId, setSelectedId] = useState<string | null>(seedThreads[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(seedThreads[0]?.aiDraft ?? "");
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");

  const loadMail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/data", { cache: "no-store" });
      const payload = (await response.json()) as { emails?: SyncedEmail[]; inboxes?: ConnectedInbox[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Email data could not be loaded.");
      }

      const nextThreads = (payload.emails ?? []).map(emailToThread);
      if (nextThreads.length) {
        setThreads(nextThreads);
        setUsingSeed(false);
        setSelectedId(nextThreads[0].id);
        setDraft(nextThreads[0].aiDraft);
        setStatus(`Loaded ${nextThreads.length} synced email${nextThreads.length === 1 ? "" : "s"}`);
      } else {
        setThreads(seedThreads);
        setUsingSeed(true);
        setSelectedId(seedThreads[0]?.id ?? null);
        setDraft(seedThreads[0]?.aiDraft ?? "");
        setStatus("Showing design sample until Gmail sync has messages");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Email data could not be loaded.");
      setThreads(seedThreads);
      setUsingSeed(true);
      setSelectedId(seedThreads[0]?.id ?? null);
      setDraft(seedThreads[0]?.aiDraft ?? "");
      setStatus("Showing design sample");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadMail();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadMail]);

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null;

  const importantCount = threads.filter((thread) => thread.priority === "High" || thread.unread).length;
  const otherCount = Math.max(0, threads.length - importantCount);
  const unreadCount = threads.filter((thread) => thread.unread).length;
  const inboxes = useMemo(() => {
    const seen = new Set<string>();
    return threads.reduce<Array<{ id: string; label: string; count: number }>>((items, thread) => {
      const existing = items.find((item) => item.id === thread.inbox);
      if (existing) {
        existing.count += 1;
        return items;
      }
      if (seen.has(thread.inbox)) return items;
      seen.add(thread.inbox);
      return [...items, { id: thread.inbox, label: thread.inboxLabel, count: 1 }];
    }, []);
  }, [threads]);

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      return matchesFilters(thread, inboxFilter, mode, unreadOnly, normalizedQuery);
    });
  }, [inboxFilter, mode, query, threads, unreadOnly]);

  function selectThread(thread: MailThread) {
    setSelectedId(thread.id);
    setDraft(thread.aiDraft);
    setStatus("Ready");
    setMobileDetailOpen(true);
  }

  function matchesFilters(thread: MailThread, nextInbox: InboxFilter, nextMode: InboxMode, nextUnreadOnly: boolean, normalizedQuery: string) {
    const isImportant = thread.priority === "High" || thread.unread;
    if (nextInbox !== "all" && thread.inbox !== nextInbox) return false;
    if (nextMode === "Important" && !isImportant) return false;
    if (nextMode === "Other" && isImportant) return false;
    if (nextUnreadOnly && !thread.unread) return false;
    if (!normalizedQuery) return true;

    return [thread.from, thread.subject, thread.preview, thread.labels.join(" "), thread.inboxLabel, thread.inbox]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }

  function selectFirstMatching(nextInbox: InboxFilter, nextMode: InboxMode, nextUnreadOnly: boolean) {
    const normalizedQuery = query.trim().toLowerCase();
    const nextThread = threads.find((thread) => matchesFilters(thread, nextInbox, nextMode, nextUnreadOnly, normalizedQuery));
    setSelectedId(nextThread?.id ?? null);
    setDraft(nextThread?.aiDraft ?? "");
  }

  function chooseInbox(nextInbox: InboxFilter) {
    setInboxFilter(nextInbox);
    selectFirstMatching(nextInbox, mode, unreadOnly);
  }

  function chooseMode(nextMode: InboxMode) {
    setMode(nextMode);
    selectFirstMatching(inboxFilter, nextMode, unreadOnly);
  }

  function toggleUnreadOnly() {
    const nextUnreadOnly = !unreadOnly;
    setUnreadOnly(nextUnreadOnly);
    selectFirstMatching(inboxFilter, mode, nextUnreadOnly);
  }

  async function syncMail() {
    setSyncing(true);
    setStatus("Syncing Gmail");
    setError(null);

    try {
      const response = await fetch("/api/integrations/google/gmail/sync", { method: "POST" });
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

  function composeMessage() {
    setDraft("");
    setStatus("Compose started locally");
  }

  function useAiDraft() {
    if (!selectedThread) return;
    setDraft(selectedThread.aiDraft);
    setStatus("AI draft inserted");
  }

  async function runEmailAction(thread: MailThread, action: "archive" | "trash" | "queueReply", nextStatus: string, options?: { draft?: string }) {
    if (usingSeed || !thread.gmailMessageId) {
      if (action === "queueReply") {
        setQueuedCount((current) => current + 1);
      }
      setClearedCount((current) => current + 1);
      advancePastThread(thread, `${nextStatus} locally`);
      return;
    }

    setActioning(true);
    setError(null);
    setStatus(action === "queueReply" ? "Creating Gmail draft" : action === "trash" ? "Moving to Gmail trash" : "Archiving in Gmail");

    try {
      const response = await fetch(`/api/email/messages/${encodeURIComponent(thread.gmailMessageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, draft: options?.draft }),
      });
      const payload = (await response.json()) as { error?: string; draftId?: string | null };

      if (!response.ok) {
        throw new Error(payload.error ?? "Email action failed.");
      }

      if (action === "queueReply") {
        setQueuedCount((current) => current + 1);
      }
      setClearedCount((current) => current + 1);
      advancePastThread(thread, action === "queueReply" && payload.draftId ? `${nextStatus} in Gmail drafts` : nextStatus);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Email action failed.");
      setStatus("Email action needs attention");
    } finally {
      setActioning(false);
    }
  }

  async function sendDraft() {
    if (!selectedThread) return;
    if (!draft.trim()) {
      setStatus("Write a draft before queueing a reply");
      return;
    }

    await runEmailAction(selectedThread, "queueReply", `${selectedThread.subject} queued for review`, { draft });
  }

  async function archiveThread() {
    if (!selectedThread) return;
    await runEmailAction(selectedThread, "archive", `${selectedThread.subject} archived`);
  }

  async function deleteThread() {
    if (!selectedThread) return;
    await runEmailAction(selectedThread, "trash", `${selectedThread.subject} moved to trash`);
  }

  function advancePastThread(thread: MailThread, nextStatus: string) {
    const threadIndex = threads.findIndex((candidate) => candidate.id === thread.id);
    const nextThreads = threads.filter((candidate) => candidate.id !== thread.id);
    const nextSelected = nextThreads[threadIndex] ?? nextThreads[threadIndex - 1] ?? null;

    setThreads(nextThreads);
    setSelectedId(nextSelected?.id ?? null);
    setDraft(nextSelected?.aiDraft ?? "");
    setStatus(nextThreads.length ? nextStatus : "Morning inbox cleared");
    if (!nextSelected) setMobileDetailOpen(false);
  }

  return (
    <section className="mx-auto flex h-[calc(100dvh-146px)] max-w-[1158px] overflow-hidden rounded-[26px] border border-[var(--line-strong)] bg-[var(--background)] shadow-[0_2px_6px_rgba(80,50,20,.06),0_30px_70px_rgba(80,50,20,.12)] lg:h-[calc(100vh-96px)]">
      <span className="sr-only" aria-live="polite">
        {error ? "Gmail needs sign-in" : usingSeed ? "Design sample" : status}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`shrink-0 flex-col gap-4 border-b border-[var(--line)] bg-[var(--background)] px-5 py-5 md:flex md:flex-row md:items-center md:justify-between md:px-7 ${
            mobileDetailOpen ? "hidden" : "flex"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[22px] font-extrabold tracking-normal">Inbox</h1>
              <p className="text-[13px] font-bold text-[var(--muted-soft)]">
                {unreadCount} unread · {threads.length} total
              </p>
            </div>
            <div className="flex h-8 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-2.5 text-[11.5px] font-extrabold text-[var(--muted)]">
              <CheckCircle2 size={14} className="text-[var(--accent-hot)]" />
              <span>{clearedCount} cleared</span>
              <span className="h-1 w-1 rounded-full bg-[#D8CBB8]" />
              <span>{queuedCount} queued</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-[38px] w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3.5 text-[13.5px] text-[#A99B82] sm:w-[230px]">
              <Search size={16} strokeWidth={2} />
              <input
                className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-[#A99B82]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search mail"
                type="search"
                value={query}
              />
            </label>
            <button
              className="os-secondary-button flex h-[38px] items-center gap-2 px-3.5 text-[13px] font-bold text-[var(--muted)] disabled:cursor-wait disabled:opacity-70"
              disabled={syncing}
              onClick={syncMail}
              type="button"
            >
              <RefreshCcw size={15} className={syncing || loading ? "animate-spin text-[var(--accent-hot)]" : "text-[var(--accent-hot)]"} />
              Sync
            </button>
            <button className="os-primary-button flex h-[38px] items-center gap-2 px-4 text-sm font-bold" onClick={composeMessage} type="button">
              <Plus size={16} />
              Compose
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className={`${mobileDetailOpen ? "hidden md:block" : "block"} w-full shrink-0 overflow-y-auto border-r border-[var(--line)] bg-[#FDFAF3] md:w-[392px]`}>
            <div className="px-[18px] pb-2 pt-3.5">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <InboxChip active={inboxFilter === "all"} count={threads.length} label="All inboxes" onClick={() => chooseInbox("all")} />
                {inboxes.map((inbox) => (
                  <InboxChip active={inboxFilter === inbox.id} count={inbox.count} key={inbox.id} label={inbox.label} onClick={() => chooseInbox(inbox.id)} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 px-[18px] pb-2.5">
              <ModeChip active={mode === "Important"} count={importantCount} label="Important" onClick={() => chooseMode("Important")} />
              <ModeChip active={mode === "Other"} count={otherCount} label="Other" onClick={() => chooseMode("Other")} />
            </div>
            <div className="px-[18px] pb-3">
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--line)] bg-white p-1 shadow-[0_8px_18px_rgba(80,50,20,.05)]">
                <MorningTool active={unreadOnly} icon={<Eye size={14} />} label="Unread" onClick={toggleUnreadOnly} />
                <MorningTool disabled={!selectedThread || actioning} icon={<Sparkles size={14} />} label="Draft" onClick={useAiDraft} />
                <MorningTool disabled={!selectedThread || actioning} icon={<Archive size={14} />} label="Clear" onClick={archiveThread} />
              </div>
            </div>

            {visibleThreads.length ? (
              visibleThreads.map((thread, index) => (
                <MailRow
                  active={selectedThread?.id === thread.id}
                  index={index}
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  thread={thread}
                />
              ))
            ) : (
              <p className="p-5 text-sm font-semibold leading-6 text-[var(--muted)]">
                {loading ? "Loading synced mail..." : threads.length ? "No messages match this view." : "Morning inbox cleared."}
              </p>
            )}
          </aside>

          <main className={`${mobileDetailOpen ? "flex" : "hidden md:flex"} min-w-0 flex-1 overflow-hidden bg-[var(--background)]`}>
            {selectedThread ? (
              <ReadingPane
                actioning={actioning}
                archiveThread={archiveThread}
                deleteThread={deleteThread}
                draft={draft}
                onBack={() => setMobileDetailOpen(false)}
                onDraftChange={setDraft}
                sendDraft={sendDraft}
                status={status}
                thread={selectedThread}
                useAiDraft={useAiDraft}
              />
            ) : (
              <div className="p-7 text-sm font-semibold text-[var(--muted)]">No email selected.</div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}

function MorningTool({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-[12px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[var(--panel-strong)] text-[var(--accent-ink)]" : "text-[var(--muted)] hover:bg-[#FBF4E8]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function InboxChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[12px] font-extrabold transition ${
        active ? "border-[#F8D6B5] bg-[var(--panel-strong)] text-[var(--accent-ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#FBF4E8]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/80 text-[var(--accent-ink)]" : "bg-[#F4ECDD] text-[var(--muted-soft)]"}`}>
        {count}
      </span>
    </button>
  );
}

function ModeChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: InboxMode;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition ${
        active ? "bg-[var(--panel-strong)] text-[var(--accent-ink)]" : "bg-[#F4ECDD] text-[#8B8173] hover:bg-[var(--panel-strong)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label} {count}
    </button>
  );
}

function MailRow({
  active,
  index,
  onClick,
  thread,
}: {
  active: boolean;
  index: number;
  onClick: () => void;
  thread: MailThread;
}) {
  return (
    <button
      className={`flex w-full gap-3 px-[18px] py-[13px] text-left transition ${
        active ? "border-l-[3px] border-l-[var(--accent-hot)] bg-[#FFF1E2]" : "border-l-[3px] border-l-transparent hover:bg-[#FBF6EC]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold ${avatarClass(index, active)}`}>
        {thread.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-extrabold text-[var(--foreground)]">{thread.from}</span>
          <span className="shrink-0 text-[11.5px] font-semibold text-[var(--muted-faint)]">{thread.time}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-bold text-[#42392E]">{thread.subject}</span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-[var(--muted-soft)]">{thread.preview}</span>
        <span className="mt-1.5 inline-flex max-w-full items-center rounded-full bg-white/75 px-2 py-0.5 text-[10.5px] font-extrabold text-[#9C7B5C] ring-1 ring-[#EFE2CF]">
          <span className="truncate">{thread.inboxLabel}</span>
        </span>
      </span>
      {thread.unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F0563B]" /> : null}
    </button>
  );
}

function ReadingPane({
  actioning,
  archiveThread,
  deleteThread,
  draft,
  onBack,
  onDraftChange,
  sendDraft,
  status,
  thread,
  useAiDraft,
}: {
  actioning: boolean;
  archiveThread: () => void;
  deleteThread: () => void;
  draft: string;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  sendDraft: () => void;
  status: string;
  thread: MailThread;
  useAiDraft: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-b border-[var(--line)] px-5 py-4 md:hidden">
        <button className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]" onClick={onBack} type="button">
          <ChevronLeft size={18} />
          Inbox
        </button>
      </div>

      <article className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-[30px]">
        <h2 className="text-[21px] font-extrabold tracking-normal text-[var(--foreground)]">{thread.subject}</h2>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-[15px] font-extrabold text-white">
            {thread.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-extrabold text-[var(--foreground)]">
              {thread.from} <span className="text-[13px] font-medium text-[var(--muted-soft)]">&lt;{thread.role}&gt;</span>
            </p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--muted-soft)]">
              to {thread.inboxLabel} · {thread.time}
            </p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <IconButton label="Star">
              <Star size={17} />
            </IconButton>
            <IconButton label="More">
              <MoreHorizontal size={17} />
            </IconButton>
          </div>
        </div>

        <section className="mt-5 rounded-2xl border border-[#F4D9BE] bg-[linear-gradient(120deg,#FFF4E8,#FDEEDD)] px-[18px] py-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={15} fill="currentColor" className="text-[var(--accent-hot)]" />
            <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--accent-ink)]">AI Summary</span>
          </div>
          <p className="text-sm font-semibold leading-6 text-[#5C4A38]">
            {thread.priority === "High"
              ? "This needs a decision soon. Reply or archive after you review the key ask."
              : "Low pressure message. Reply later or archive when finished."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="os-primary-button px-3 py-2 text-[12.5px] font-bold" disabled={actioning} onClick={useAiDraft} type="button">
              Draft reply
            </button>
            <button className="os-secondary-button px-3 py-2 text-[12.5px] font-bold text-[var(--muted)]" disabled={actioning} onClick={archiveThread} type="button">
              Archive
            </button>
          </div>
        </section>

        <div className="mt-5 max-w-[620px] text-[14.5px] leading-7 text-[#42392E]">
          {thread.body.map((paragraph) => (
            <p className="mb-3.5" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <Sparkles size={16} className="text-[var(--accent-hot)]" />
              AI reply
            </div>
            <button className="text-xs font-extrabold text-[var(--accent-ink)] disabled:opacity-50" disabled={actioning} onClick={useAiDraft} type="button">
              Rewrite
            </button>
          </div>
          <textarea
            className="min-h-28 w-full resize-y rounded-b-2xl bg-white p-4 text-sm font-medium leading-6 outline-none placeholder:text-[var(--muted-soft)]"
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Draft a reply..."
            value={draft}
          />
        </section>
      </article>

      <footer className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--line)] bg-[#FDFAF3] px-5 pb-24 pt-3 md:px-[30px] md:pb-4 md:pt-3">
        <button className="os-primary-button flex items-center gap-2 px-5 py-3 text-sm font-bold" disabled={actioning} onClick={useAiDraft} type="button">
          <CornerUpLeft size={16} />
          Reply
        </button>
        <button className="os-secondary-button px-4 py-3 text-sm font-bold text-[var(--muted)]" disabled={actioning} onClick={sendDraft} type="button">
          <Send size={16} className="mr-2 inline" />
          {actioning ? "Working..." : "Queue reply"}
        </button>
        <span className="hidden flex-1 md:block" />
        <button className="os-secondary-button px-4 py-3 text-sm font-bold text-[var(--muted)]" disabled={actioning} onClick={archiveThread} type="button">
          <Archive size={16} className="mr-2 inline" />
          Archive
        </button>
        <button className="os-secondary-button px-4 py-3 text-sm font-bold text-[var(--muted)]" disabled={actioning} onClick={deleteThread} type="button">
          <Trash2 size={16} className="mr-2 inline" />
          Delete
        </button>
        <span className="sr-only" aria-live="polite">{status}</span>
      </footer>
    </div>
  );
}

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--line)] bg-white text-[var(--muted)]"
      type="button"
    >
      {children}
    </button>
  );
}
