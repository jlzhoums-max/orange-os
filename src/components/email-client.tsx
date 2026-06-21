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
  Star,
  Tag,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type InboxSplit = "Important" | "Team" | "VIPs" | "Tools" | "News";

type SyncedEmail = {
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  labels: string[] | null;
};

type MailThread = {
  id: string;
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
  labels: string[];
  aiDraft: string;
};

const splitIcons: Record<InboxSplit, LucideIcon> = {
  Important: Zap,
  Team: Users,
  VIPs: Star,
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

function splitFromEmail(email: SyncedEmail): InboxSplit {
  const haystack = [email.sender, email.subject, email.snippet, ...(email.labels ?? [])].join(" ").toLowerCase();

  if (haystack.includes("important") || haystack.includes("urgent")) return "Important";
  if (haystack.includes("calendar") || haystack.includes("investor") || haystack.includes("vip")) return "VIPs";
  if (haystack.includes("newsletter") || haystack.includes("brief") || haystack.includes("news")) return "News";
  if (haystack.includes("stripe") || haystack.includes("openai") || haystack.includes("google") || haystack.includes("vercel")) return "Tools";
  return "Team";
}

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

function emailToThread(email: SyncedEmail, index: number): MailThread {
  const from = cleanSender(email.sender);
  const subject = email.subject?.trim() || "(No subject)";
  const preview = email.snippet?.trim() || "No preview was synced for this message.";
  const labels = email.labels?.filter(Boolean).slice(0, 4) ?? [];

  return {
    id: `${email.received_at ?? "email"}-${index}`,
    split: splitFromEmail(email),
    from,
    role: senderRole(email.sender),
    subject,
    preview,
    body: [preview],
    time: formatMailTime(email.received_at),
    unread: labels.some((label) => label.toLowerCase() === "unread"),
    priority: priorityFromEmail(email),
    readStatus: labels.some((label) => label.toLowerCase() === "unread") ? "Unread" : "Synced",
    reminder: "No reminder set",
    labels: labels.length ? labels : ["Gmail"],
    aiDraft: `Draft a concise reply to "${subject}" after I review the full context.`,
  };
}

function priorityClass(priority: MailThread["priority"]) {
  if (priority === "High") return "border-[#ff9b68]/55 bg-[#fff1e8] text-[#b9470f]";
  if (priority === "Low") return "border-[#e8d0bd] bg-[#fffaf4] text-[#8a6a52]";
  return "border-[#b8d8a3] bg-[#f3f9ea] text-[#58733d]";
}

export function EmailClient() {
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [activeSplit, setActiveSplit] = useState<InboxSplit>("Important");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [reminder, setReminder] = useState("No reminder set");
  const [status, setStatus] = useState("Loading synced mail");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/data", { cache: "no-store" });
      const payload = (await response.json()) as { emails?: SyncedEmail[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Email data could not be loaded.");
      }

      const nextThreads = (payload.emails ?? []).map(emailToThread);
      setThreads(nextThreads);
      setSelectedId(nextThreads[0]?.id ?? null);
      setDraft(nextThreads[0]?.aiDraft ?? "");
      setReminder(nextThreads[0]?.reminder ?? "No reminder set");
      setStatus(nextThreads.length ? `Loaded ${nextThreads.length} synced email${nextThreads.length === 1 ? "" : "s"}` : "No synced mail yet");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Email data could not be loaded.");
      setThreads([]);
      setSelectedId(null);
      setDraft("");
      setStatus("Email connection needs attention");
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

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesSplit = activeSplit === "Important" ? thread.priority === "High" || thread.split === "Important" : thread.split === activeSplit;

      if (!matchesSplit) return false;
      if (!normalizedQuery) return true;

      return [thread.from, thread.subject, thread.preview, thread.labels.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeSplit, query, threads]);

  function selectThread(thread: MailThread) {
    setSelectedId(thread.id);
    setDraft(thread.aiDraft);
    setReminder(thread.reminder);
    setStatus("Ready");
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

  function useAiDraft() {
    if (!selectedThread) return;
    setDraft(selectedThread.aiDraft);
    setStatus("AI draft inserted");
  }

  function sendDraft() {
    setStatus("Draft queued for your review");
  }

  function archiveThread() {
    if (!selectedThread) return;
    setStatus(`${selectedThread.subject} archived locally`);
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

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5 xl:grid-cols-1">
            {(Object.keys(splitIcons) as InboxSplit[]).map((split) => {
              const Icon = splitIcons[split];
              const count = split === "Important" ? threads.filter((thread) => thread.priority === "High").length : threads.filter((thread) => thread.split === split).length;
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
                <MailAction icon={Archive} label="Archive" onClick={archiveThread} disabled={!selectedThread} />
                <MailAction icon={Clock3} label="Remind" onClick={() => setStatus(reminder)} disabled={!selectedThread} />
                <MailAction icon={CornerUpLeft} label="Reply" onClick={useAiDraft} variant="primary" disabled={!selectedThread} />
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
                    {selectedThread.body.map((paragraph) => (
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
                <p className="text-xs font-semibold text-[#7a5a42]">Replies stay queued until you confirm a future send flow</p>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#ff6b1a] px-4 text-sm font-bold text-white hover:bg-[#ff7d33] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedThread}
                  onClick={sendDraft}
                  type="button"
                >
                  <Send size={15} />
                  Queue reply
                </button>
              </div>
            </section>
          </article>
        </main>

        <aside className="border-t border-[#f0c9a9] bg-[#fff7ed] p-4 xl:col-span-3 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
          <div className="grid gap-3">
            <AssistantCard icon={Sparkles} title="AI summary">
              <p className="text-sm leading-6 text-[#6f4a32]">
                {selectedThread
                  ? `This synced thread is about "${selectedThread.subject}". Drafts remain local until you confirm sending.`
                  : "Sync Gmail to populate live message context for summaries and drafts."}
              </p>
            </AssistantCard>

            <AssistantCard icon={Bell} title="Follow-up">
              <input
                className="h-10 w-full rounded-lg border border-[#edc9ac] bg-white px-3 text-sm text-[#3b2416] outline-none focus:border-[#ff6b1a]"
                disabled={!selectedThread}
                onChange={(event) => setReminder(event.target.value)}
                value={reminder}
              />
            </AssistantCard>

            <AssistantCard icon={MailCheck} title="Read status">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#3b2416]">
                <CheckCheck size={16} className="text-[#6f8f4e]" />
                {selectedThread?.readStatus ?? "No message selected"}
              </div>
            </AssistantCard>

            <AssistantCard icon={CalendarDays} title="Calendar fit">
              <div className="space-y-2 text-sm text-[#6f4a32]">
                <p>Calendar-aware reply suggestions are next once Gmail detail sync is expanded.</p>
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
