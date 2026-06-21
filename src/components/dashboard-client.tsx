"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock,
  DatabaseZap,
  Gauge,
  Mail,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { IntegrationStatus } from "@/components/integration-status";
import {
  briefItems,
  calendarItems,
  dashboardMetrics,
  dayPartBriefs,
  inboxItems,
  marketItems,
  type DayPart,
  type InboxItem,
  type CalendarItem,
  type MarketItem,
} from "@/lib/dashboard-data";

function getDayPart(date: Date): DayPart {
  const hour = date.getHours();

  if (hour < 11) {
    return "morning";
  }

  if (hour < 17) {
    return "midday";
  }

  if (hour < 21) {
    return "evening";
  }

  return "night";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function toneClass(tone: string) {
  if (tone === "good") {
    return "border-lime-200 bg-[#f3ffd7] text-[#364e00]";
  }

  if (tone === "warning") {
    return "border-orange-200 bg-[#fff0db] text-[#633b00]";
  }

  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  return "border-[#d8c3af] bg-[var(--panel-strong)] text-[var(--foreground)]";
}

function riskClass(risk: string) {
  const base = "rounded-full px-2 py-0.5 text-[11px] font-semibold";

  if (risk === "High") {
    return `${base} bg-red-100 text-red-800`;
  }

  if (risk === "Medium") {
    return `${base} bg-amber-100 text-amber-800`;
  }

  return `${base} bg-emerald-100 text-emerald-800`;
}

type DashboardClientProps = {
  initialTimestamp: string;
};

type LiveDashboardData = {
  emails: Array<{
    sender: string | null;
    subject: string | null;
    snippet: string | null;
    received_at: string | null;
    labels: string[];
  }>;
  events: Array<{
    title: string | null;
    starts_at: string | null;
    ends_at: string | null;
    location: string | null;
  }>;
  quotes: Array<{
    symbol: string;
    price: number | null;
    change_percent: number | null;
    provider: string;
    fetched_at: string;
  }>;
  refreshedAt: string;
};

type AiBrief = {
  headline: string;
  narrative: string;
  focus_items: Array<{ label: string; value: string; tone: string }>;
  suggested_tasks: Array<{ title: string; reason: string; priority: string; source: string }>;
  reply_drafts: Array<{
    recipient: string;
    subject: string;
    draft: string;
    confirmationRequired: true;
  }>;
  project_updates: Array<{
    project: string;
    update: string;
    nextAction: string;
    risk: string;
  }>;
  created_at: string;
};

const marketNames: Record<string, string> = {
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  VNQ: "Real Estate ETF",
};

const autoSyncStorageKey = "orange-os-last-auto-sync";
const autoSyncCooldownMs = 5 * 60 * 1000;

function formatEventTime(value: string | null) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function inboxUrgency(labels: string[]): InboxItem["urgency"] {
  if (labels.includes("IMPORTANT")) {
    return "High";
  }

  if (labels.includes("UNREAD")) {
    return "Medium";
  }

  return "Low";
}

function senderName(sender: string | null) {
  if (!sender) {
    return "Unknown sender";
  }

  return sender.replace(/\s*<[^>]+>/, "");
}

export function DashboardClient({ initialTimestamp }: DashboardClientProps) {
  const initialDate = useMemo(() => new Date(initialTimestamp), [initialTimestamp]);
  const [now, setNow] = useState(initialDate);
  const [lastRefresh, setLastRefresh] = useState(initialDate);
  const [liveData, setLiveData] = useState<LiveDashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState<AiBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const dayPart = useMemo(() => getDayPart(now), [now]);

  const loadLiveData = useCallback(async () => {
    setDataLoading(true);
    try {
      const response = await fetch("/api/dashboard/data");
      if (response.ok) {
        setLiveData((await response.json()) as LiveDashboardData);
        setLastRefresh(new Date());
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

  const syncDailyData = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const [gmail, calendar, market] = await Promise.all([
        fetch("/api/integrations/google/gmail/sync", { method: "POST" }),
        fetch("/api/integrations/google/calendar/sync", { method: "POST" }),
        fetch("/api/market/quotes?symbols=SPY,QQQ,VNQ"),
      ]);

      if (!gmail.ok || !calendar.ok || !market.ok) {
        throw new Error("Sync could not finish. Try reconnecting Google if this repeats.");
      }

      const [gmailData, calendarData] = (await Promise.all([
        gmail.json(),
        calendar.json(),
      ])) as Array<{ synced?: number }>;

      await loadLiveData();
      setSyncMessage(
        `Synced ${gmailData.synced ?? 0} emails and ${calendarData.synced ?? 0} calendar events.`,
      );
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [loadLiveData]);

  const loadAiBrief = useCallback(async () => {
    const response = await fetch("/api/ai/brief");
    if (response.ok) {
      const payload = (await response.json()) as { brief: AiBrief | null };
      setAiBrief(payload.brief);
    }
  }, []);

  async function generateAiBrief() {
    setBriefLoading(true);
    setBriefError(null);

    try {
      await syncDailyData();
      const response = await fetch("/api/ai/brief", { method: "POST" });
      const payload = (await response.json()) as { brief?: AiBrief; error?: string };

      if (!response.ok || !payload.brief) {
        throw new Error(payload.error ?? "AI brief failed.");
      }

      setAiBrief(payload.brief);
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : "AI brief failed.");
    } finally {
      setBriefLoading(false);
    }
  }

  const liveInboxItems = useMemo<InboxItem[]>(() => {
    if (!liveData?.emails.length) {
      return inboxItems;
    }

    return liveData.emails.slice(0, 3).map((email) => ({
      from: senderName(email.sender),
      subject: email.subject ?? "No subject",
      urgency: inboxUrgency(email.labels ?? []),
      summary: email.snippet ?? "No preview available.",
    }));
  }, [liveData]);

  const liveCalendarItems = useMemo<CalendarItem[]>(() => {
    if (!liveData?.events.length) {
      return calendarItems;
    }

    return liveData.events.slice(0, 3).map((event) => ({
      time: formatEventTime(event.starts_at),
      title: event.title ?? "Untitled event",
      context: event.location ? `Location: ${event.location}` : "Synced from Google Calendar.",
    }));
  }, [liveData]);

  const liveMarketItems = useMemo<MarketItem[]>(() => {
    if (!liveData?.quotes.length) {
      return marketItems;
    }

    return liveData.quotes.map((quote) => {
      const change = quote.change_percent ?? 0;

      return {
        symbol: quote.symbol,
        name: marketNames[quote.symbol] ?? quote.provider,
        price: quote.price == null ? "N/A" : quote.price.toFixed(2),
        change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
        direction: change >= 0 ? "up" : "down",
      };
    });
  }, [liveData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    const refreshTimer = window.setInterval(() => {
      setLastRefresh(new Date());
    }, 60000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLiveData();
      void loadAiBrief();
    }, 0);

    const syncTimer = window.setTimeout(() => {
      const lastAutoSync = Number(window.sessionStorage.getItem(autoSyncStorageKey) ?? 0);
      if (Date.now() - lastAutoSync < autoSyncCooldownMs) {
        return;
      }

      window.sessionStorage.setItem(autoSyncStorageKey, String(Date.now()));
      void syncDailyData();
    }, 800);

    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(syncTimer);
    };
  }, [loadAiBrief, loadLiveData, syncDailyData]);

  return (
    <AppChrome active="Home">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        <section className="grid gap-4 xl:grid-cols-[1fr_21rem]">
          <div className="os-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <span>Good {dayPart}, Justin</span>
                  <span className="h-1 w-1 rounded-full bg-[var(--muted-soft)]" />
                  <span className="text-[var(--muted)]">
                    {dataLoading ? "Refreshing..." : `Refreshed ${formatTime(lastRefresh)}`}
                  </span>
                </div>
                <h1 className="os-section-title mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
                  Today&apos;s command center
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {dayPartBriefs[dayPart]}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  className="os-primary-button inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                  disabled={briefLoading}
                  onClick={generateAiBrief}
                  type="button"
                >
                  <Sparkles size={15} />
                  {briefLoading ? "Generating..." : "Brief"}
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]"
                  disabled={syncing}
                  onClick={syncDailyData}
                  type="button"
                >
                  <RefreshCcw size={15} />
                  {syncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {dashboardMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-[var(--line)] bg-white/58 p-2.5 sm:p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                    <metric.icon size={14} className="text-[var(--accent)]" />
                    {metric.label}
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-semibold leading-none">{metric.value}</p>
                    <p className="mt-1 hidden text-xs leading-4 text-[var(--muted)] sm:line-clamp-1">{metric.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-1.5 md:grid-cols-3">
              {(aiBrief?.focus_items?.length ? aiBrief.focus_items : briefItems).slice(0, 3).map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 md:block md:py-2.5 ${toneClass(item.tone)}`}
                >
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em]">{item.label}</p>
                  <p className="line-clamp-1 text-right text-sm font-semibold leading-5 md:mt-1 md:line-clamp-2 md:text-left">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <QuickCaptureCard />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Panel title="Priority inbox" icon={Mail}>
            <div className="space-y-3">
              {liveInboxItems.map((item) => (
                <article key={item.subject} className="rounded-md border border-[var(--line)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.from}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.subject}</p>
                    </div>
                    <span className={riskClass(item.urgency)}>{item.urgency}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Calendar runway" icon={Clock}>
            <div className="space-y-3">
              {liveCalendarItems.map((event) => (
                <article key={event.title} className="grid grid-cols-[74px_1fr] gap-3 rounded-md border border-[var(--line)] p-3">
                  <p className="font-mono text-sm text-[var(--accent-ink)]">{event.time}</p>
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{event.context}</p>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Market watch" icon={Activity}>
            <div className="space-y-3">
              {liveMarketItems.map((item) => (
                <article key={item.symbol} className="flex items-center justify-between rounded-md border border-[var(--line)] p-3">
                  <div>
                    <p className="font-mono font-semibold">{item.symbol}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.price}</p>
                    <p className={item.direction === "up" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
                      {item.change}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="os-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Bot size={18} />
                  AI Brief
                </div>
                <h2 className="mt-1 text-xl font-semibold">Next best action</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                <RefreshCcw size={13} className={dataLoading ? "animate-spin text-[var(--accent)]" : "text-[var(--accent)]"} />
                {formatTime(lastRefresh)}
              </span>
            </div>

            <div className="os-card-soft mt-4 p-4">
              <p className="text-sm font-medium text-[var(--muted)]">Recommendation</p>
              <p className="mt-1 text-base font-semibold leading-6">
                {aiBrief?.headline
                  ? aiBrief.headline
                  : liveInboxItems[0]?.subject
                  ? `Start with "${liveInboxItems[0].subject}", then review the next calendar commitment.`
                  : "Confirm the Oak Ridge inspection window before the 3 PM deadline, then review the Maple Ave term sheet."}
              </p>
              {aiBrief?.narrative ? (
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{aiBrief.narrative}</p>
              ) : null}
              {syncMessage ? <p className="mt-2 text-sm text-[var(--muted)]">{syncMessage}</p> : null}
              {briefError ? <p className="mt-2 text-sm text-red-700">{briefError}</p> : null}
            </div>

            {aiBrief ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <AiSuggestionList
                  title="Tasks"
                  items={aiBrief.suggested_tasks.map((task) => ({
                    title: task.title,
                    body: `${task.priority} priority - ${task.reason}`,
                  }))}
                />
                <AiSuggestionList
                  title="Reply drafts"
                  items={aiBrief.reply_drafts.map((draft) => ({
                    title: draft.subject,
                    body: `${draft.recipient}: ${draft.draft}`,
                  }))}
                />
                <AiSuggestionList
                  title="Project updates"
                  items={aiBrief.project_updates.map((update) => ({
                    title: update.project,
                    body: `${update.update} Next: ${update.nextAction}`,
                  }))}
                />
              </div>
            ) : null}
          </div>

          <div className="os-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              <DatabaseZap size={18} />
              Data connections
            </div>
            <div className="mt-3 grid gap-2">
              {[
                ["Gmail", "Live", Mail],
                ["Google Calendar", "Live", CalendarDays],
                ["Market data", "Live", Gauge],
                ["Project memory", "Live", Bell],
              ].map(([label, status, Icon]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icon size={17} />
                    {label as string}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-[var(--muted)]">
                    {status as string}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <IntegrationStatus onSynced={loadLiveData} />
            </div>
          </div>
        </section>

      </div>
    </AppChrome>
  );
}

type PanelProps = {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
};

function Panel({ title, icon: Icon, children }: PanelProps) {
  return (
    <section className="os-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
          <Icon size={18} />
          {title}
        </div>
        <ChevronRight size={17} className="text-[var(--muted)]" />
      </div>
      {children}
    </section>
  );
}

function QuickCaptureCard() {
  return (
    <section className="os-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        <Sparkles size={18} />
        Quick Capture
      </div>
      <div className="mt-3 flex gap-2">
        <input className="os-input h-10 min-w-0 flex-1 px-3 text-sm" placeholder="Capture task, note, or event..." />
        <button className="os-primary-button flex h-10 w-10 shrink-0 items-center justify-center" type="button">
          <Sparkles size={18} />
        </button>
      </div>
      <div className="mt-3 hidden gap-2 text-sm sm:grid">
        {["Review ledger pacing", "Call contractor about photos", "Draft project update"].map((note, index) => (
          <div className="flex justify-between gap-3" key={note}>
            <span className="min-w-0 truncate">{note}</span>
            <span className="text-[var(--muted)]">{index === 0 ? "Today" : "Soon"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type AiSuggestionListProps = {
  title: string;
  items: Array<{ title: string; body: string }>;
};

function AiSuggestionList({ title, items }: AiSuggestionListProps) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--line)] bg-white p-3">
      <p className="text-sm font-semibold text-[var(--accent)]">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.slice(0, 2).map((item) => (
            <div key={`${title}-${item.title}`} className="rounded-lg bg-[var(--panel-strong)] p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No suggestions yet.</p>
        )}
      </div>
    </div>
  );
}
