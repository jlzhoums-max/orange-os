"use client";

import { useMemo, useState } from "react";
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
  PenLine,
  Plus,
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

const threads: MailThread[] = [
  {
    id: "inspection-window",
    split: "Important",
    from: "Maya Chen",
    role: "Oak Ridge escrow",
    subject: "Inspection window and disclosure packet",
    preview: "We can hold the inspector for 10:30 AM if you confirm the access notes before noon.",
    body: [
      "Justin, we can hold the 10:30 AM inspection window for Oak Ridge if you confirm the access notes before noon.",
      "The seller uploaded the updated disclosure packet this morning. The only new item I noticed is the electrical panel note from 2023, which should be easy to clarify during the walkthrough.",
      "If the timing still works, reply with the gate code and whether you want the foundation specialist added to the calendar invite.",
    ],
    time: "9:42 AM",
    unread: true,
    priority: "High",
    readStatus: "Read by 3 of 4",
    reminder: "Follow up at 11:30 AM",
    labels: ["Deal", "Needs reply"],
    aiDraft:
      "Maya, 10:30 AM works. Gate code is 4319. Please add the foundation specialist to the invite and send the updated disclosure packet to the inspection folder.",
  },
  {
    id: "operator-update",
    split: "Team",
    from: "Andre Patel",
    role: "Operations",
    subject: "Weekly priorities before tomorrow's review",
    preview: "I grouped the open vendor items by blocker, owner, and follow-up date.",
    body: [
      "I grouped the open vendor items by blocker, owner, and follow-up date so tomorrow's review can stay tight.",
      "The main issue is still the receipt flow. Everything else is ready for quick decisions.",
    ],
    time: "8:15 AM",
    unread: false,
    priority: "Normal",
    readStatus: "Seen by team",
    reminder: "Tomorrow 8:45 AM",
    labels: ["Team", "Review"],
    aiDraft: "Andre, this is clean. Let's start with receipt flow, then close the vendor decisions in the first ten minutes.",
  },
  {
    id: "investor-lunch",
    split: "VIPs",
    from: "Elena Rivera",
    role: "Investor",
    subject: "Lunch next week",
    preview: "Could you do Tuesday or Thursday? I would like to hear how the dashboard is coming together.",
    body: [
      "Could you do Tuesday or Thursday for lunch? I would like to hear how the dashboard is coming together.",
      "If useful, bring a couple of screenshots. The email and real estate flows sound especially relevant.",
    ],
    time: "Yesterday",
    unread: true,
    priority: "High",
    readStatus: "Unread",
    reminder: "Nudge tomorrow",
    labels: ["VIP", "Calendar"],
    aiDraft: "Elena, Thursday works well. I can bring a concise walkthrough of the email and real estate flows.",
  },
  {
    id: "stripe-alert",
    split: "Tools",
    from: "Stripe",
    role: "Billing",
    subject: "New payout summary available",
    preview: "Your payout summary for this week is ready to review.",
    body: [
      "Your payout summary for this week is ready to review.",
      "There are no failed transfers. Two invoices remain in retry status.",
    ],
    time: "Yesterday",
    unread: false,
    priority: "Low",
    readStatus: "Opened",
    reminder: "None",
    labels: ["Finance"],
    aiDraft: "No reply needed. Archive after ledger review.",
  },
  {
    id: "ai-news",
    split: "News",
    from: "Product Brief",
    role: "Newsletter",
    subject: "AI mail clients are moving toward agentic workflows",
    preview: "The best products now combine fast keyboard navigation with always-on drafting.",
    body: [
      "The best products now combine fast keyboard navigation with always-on drafting.",
      "Users increasingly expect triage, reminders, snippets, and calendar intelligence to live in the same mail surface.",
    ],
    time: "Mon",
    unread: false,
    priority: "Normal",
    readStatus: "Opened",
    reminder: "None",
    labels: ["Research"],
    aiDraft: "Save this to research notes and archive.",
  },
];

const commandItems = [
  "Archive thread",
  "Set reminder",
  "Insert snippet",
  "Summarize sender history",
  "Find calendar time",
  "Forward to task list",
];

function priorityClass(priority: MailThread["priority"]) {
  if (priority === "High") {
    return "border-[#ff9b68]/40 bg-[#ff7a2f]/15 text-[#ffd2ba]";
  }

  if (priority === "Low") {
    return "border-white/10 bg-white/[0.04] text-[#b8c2d8]";
  }

  return "border-[#6ee7b7]/25 bg-[#10b981]/10 text-[#b9f7d9]";
}

export function EmailClient() {
  const [activeSplit, setActiveSplit] = useState<InboxSplit>("Important");
  const [selectedId, setSelectedId] = useState("inspection-window");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(threads[0].aiDraft);
  const [reminder, setReminder] = useState("Follow up at 11:30 AM");
  const [status, setStatus] = useState("Ready");

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? threads[0];

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesSplit = activeSplit === "Important" ? thread.priority === "High" || thread.split === "Important" : thread.split === activeSplit;

      if (!matchesSplit) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [thread.from, thread.subject, thread.preview, thread.labels.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeSplit, query]);

  function selectThread(thread: MailThread) {
    setSelectedId(thread.id);
    setDraft(thread.aiDraft);
    setReminder(thread.reminder);
    setStatus("Ready");
  }

  function useAiDraft() {
    setDraft(selectedThread.aiDraft);
    setStatus("AI draft inserted");
  }

  function sendDraft() {
    setStatus("Draft queued for review");
  }

  function archiveThread() {
    setStatus(`${selectedThread.subject} archived`);
  }

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[#1f2940] bg-[#080d18] text-[#f5f7fb] shadow-[0_24px_80px_rgba(15,21,36,0.28)]">
      <div className="flex min-h-[820px] flex-col xl:grid xl:grid-cols-[4.5rem_minmax(18rem,24rem)_minmax(32rem,1fr)] 2xl:grid-cols-[4.5rem_minmax(18rem,24rem)_minmax(0,1fr)_21rem]">
        <CommandRail status={status} />

        <aside className="border-b border-white/10 bg-[#0d1422] xl:border-b-0 xl:border-r">
          <div className="border-b border-white/10 p-4">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ff6b1a] px-4 text-sm font-bold text-white shadow-[0_16px_26px_rgba(255,107,26,0.24)] hover:bg-[#ff7d33]"
              type="button"
            >
              <PenLine size={17} />
              Compose
            </button>
            <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#111a2b] px-3 text-sm text-[#dce5f7]">
              <Search size={16} className="text-[#77839c]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#77839c]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search mail..."
                type="search"
                value={query}
              />
              <Command size={13} className="text-[#77839c]" />
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
                      ? "bg-white text-[#0b1020]"
                      : "border border-white/0 text-[#aeb8cc] hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                  }`}
                  key={split}
                  onClick={() => setActiveSplit(split)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={16} className={isActive ? "text-[#ff6b1a]" : "text-[#7d89a2]"} />
                    <span className="truncate">{split}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-[#fff1e9] text-[#e85d11]" : "bg-white/[0.06] text-[#8f9bb4]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/10">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => (
                <button
                  className={`block w-full border-b border-white/10 px-4 py-4 text-left transition ${
                    selectedThread.id === thread.id ? "bg-[#182234]" : "hover:bg-white/[0.035]"
                  }`}
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {thread.unread ? <span className="h-2 w-2 rounded-full bg-[#ff6b1a]" /> : null}
                        <p className="truncate text-sm font-bold text-white">{thread.from}</p>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-semibold text-[#d7deed]">{thread.subject}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[#818da7]">{thread.time}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#8f9bb4]">{thread.preview}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(thread.priority)}`}>
                      {thread.priority}
                    </span>
                    {thread.labels.slice(0, 2).map((label) => (
                      <span className="rounded-full bg-white/[0.055] px-2 py-0.5 text-[11px] text-[#aab4c9]" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-5 text-sm leading-6 text-[#8f9bb4]">No threads match this split and search.</div>
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-[#f6f7fb] text-[#111827]">
          <div className="sticky top-0 z-10 border-b border-[#d9deea] bg-[#f6f7fb]/92 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ff6b1a]">Orange OS Mail</p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-normal text-[#101828] sm:text-2xl">{selectedThread.subject}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <MailAction icon={Archive} label="Archive" onClick={archiveThread} />
                <MailAction icon={Clock3} label="Remind" onClick={() => setStatus(reminder)} />
                <MailAction icon={CornerUpLeft} label="Reply" onClick={useAiDraft} variant="primary" />
              </div>
            </div>
          </div>

          <article className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
            <div className="rounded-lg border border-[#dce2ee] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-[#e3e8f2] p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#101827] text-sm font-bold text-white">
                    {selectedThread.from.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#101828]">{selectedThread.from}</p>
                    <p className="text-sm text-[#667085]">{selectedThread.role}</p>
                    <p className="mt-2 text-sm text-[#475467]">To Justin Zhou</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#667085]">
                  <span>{selectedThread.time}</span>
                  <button className="rounded-full p-2 text-[#667085] hover:bg-[#f0f3f9]" aria-label="More actions" type="button">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5 text-[15px] leading-7 text-[#283142] sm:p-7">
                {selectedThread.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="border-t border-[#e3e8f2] bg-[#fbfcff] p-4 sm:p-5">
                <div className="flex flex-wrap gap-2">
                  {selectedThread.labels.map((label) => (
                    <span className="rounded-full bg-[#fff1e9] px-3 py-1 text-xs font-bold text-[#d85d13]" key={label}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <section className="mt-4 rounded-lg border border-[#dce2ee] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between border-b border-[#e3e8f2] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#101828]">
                  <Sparkles size={17} className="text-[#ff6b1a]" />
                  AI reply
                </div>
                <button
                  className="rounded-full border border-[#ffd0b8] bg-[#fff7f2] px-3 py-1.5 text-xs font-bold text-[#d85d13] hover:bg-[#ffeadf]"
                  onClick={useAiDraft}
                  type="button"
                >
                  Rewrite
                </button>
              </div>
              <textarea
                className="min-h-32 w-full resize-y rounded-b-lg bg-white p-4 text-sm leading-6 text-[#1f2937] outline-none"
                onChange={(event) => setDraft(event.target.value)}
                value={draft}
              />
              <div className="flex flex-col gap-3 border-t border-[#e3e8f2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-[#667085]">Press Cmd + Enter to send after review</p>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#101827] px-4 text-sm font-bold text-white hover:bg-[#1d2939]"
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

        <aside className="border-t border-white/10 bg-[#0d1422] p-4 xl:col-span-3 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
          <div className="grid gap-3">
            <AssistantCard icon={Sparkles} title="AI summary">
              <p className="text-sm leading-6 text-[#aeb8cc]">
                This thread needs a same-day confirmation. Reply with access details, add the specialist, and save the disclosure update.
              </p>
            </AssistantCard>

            <AssistantCard icon={Bell} title="Follow-up">
              <input
                className="h-10 w-full rounded-lg border border-white/10 bg-[#111a2b] px-3 text-sm text-white outline-none focus:border-[#ff6b1a]"
                onChange={(event) => setReminder(event.target.value)}
                value={reminder}
              />
            </AssistantCard>

            <AssistantCard icon={MailCheck} title="Read status">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#dce5f7]">
                <CheckCheck size={16} className="text-[#6ee7b7]" />
                {selectedThread.readStatus}
              </div>
            </AssistantCard>

            <AssistantCard icon={CalendarDays} title="Calendar fit">
              <div className="space-y-2 text-sm text-[#aeb8cc]">
                <p>10:30 AM inspection window is open.</p>
                <p>2:00 PM has a 20-minute travel buffer.</p>
              </div>
            </AssistantCard>

            <AssistantCard icon={MessageSquare} title="Team notes">
              <div className="space-y-3">
                {["Ask about electrical panel note.", "Attach photos to property record."].map((note) => (
                  <label className="flex items-start gap-2 text-sm text-[#aeb8cc]" key={note}>
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#ff8a4c]/50 text-[#ff8a4c]">
                      <Check size={11} />
                    </span>
                    {note}
                  </label>
                ))}
              </div>
            </AssistantCard>

            <AssistantCard icon={Keyboard} title="Shortcuts">
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#aeb8cc]">
                {commandItems.slice(0, 4).map((item, index) => (
                  <button
                    className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-left hover:border-[#ff6b1a]/45 hover:text-white"
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
    <aside className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#070b13] px-3 py-3 xl:flex-col xl:border-b-0 xl:border-r xl:px-0 xl:py-4">
      <div className="flex items-center gap-2 xl:flex-col">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b1a] text-white shadow-[0_14px_26px_rgba(255,107,26,0.22)]">
          <Mail size={19} />
        </div>
        <div className="hidden h-px w-8 bg-white/10 xl:block" />
        {items.map((Icon, index) => (
          <button
            aria-label={`Mail command ${index + 1}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#7d89a2] hover:bg-white/[0.06] hover:text-white"
            key={index}
            type="button"
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <div className="hidden max-w-14 -rotate-90 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.18em] text-[#68758f] xl:block">
        {status}
      </div>
      <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#7d89a2] hover:text-white" aria-label="New command" type="button">
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
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition ${
        variant === "primary"
          ? "bg-[#ff6b1a] text-white hover:bg-[#ff7d33]"
          : "border border-[#d6ddea] bg-white text-[#344054] hover:bg-[#edf1f8]"
      }`}
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
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
        <Icon size={16} className="text-[#ff8a4c]" />
        {title}
      </div>
      {children}
    </section>
  );
}
