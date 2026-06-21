"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  DatabaseZap,
  Gauge,
  Mail,
  RefreshCcw,
  Sparkles,
  Target,
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
  if (risk === "High") {
    return "bg-red-100 text-red-800";
  }

  if (risk === "Medium") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-emerald-100 text-emerald-800";
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
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <section className="grid gap-5 xl:grid-cols-[1fr_0.34fr]">
          <div className="os-card os-watermark relative overflow-hidden p-6 sm:p-8 lg:min-h-[24rem]">
            <div className="relative z-10 max-w-3xl">
              <h1 className="os-section-title text-4xl font-bold tracking-normal text-balance sm:text-5xl">
                Good {dayPart}, Justin.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                {dayPartBriefs[dayPart]}
              </p>

              <div className="mt-10 lg:max-w-[58%]">
                <p className="os-label">Today&apos;s focus</p>
                <div className="mt-4 grid gap-3">
                  {(aiBrief?.focus_items?.length ? aiBrief.focus_items : briefItems).slice(0, 3).map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gradient-citrus)] text-white">
                        <CheckCircle2 size={15} />
                      </span>
                      <span className="line-clamp-2 text-[13px] font-semibold leading-5 sm:text-sm">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 hidden h-72 w-2/3 overflow-hidden rounded-br-[1.75rem] lg:block">
              <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(160deg,rgba(255,176,43,0.04),rgba(244,126,22,0.42)_55%,rgba(232,75,27,0.9))]" />
              <div className="absolute bottom-9 right-28 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_36%_28%,#fff7e9_0_7%,#ffb02b_8%,#f47e16_58%,#e84b1b_100%)] shadow-[0_24px_70px_rgba(232,75,27,0.23)]">
                <div className="absolute inset-6 rounded-full border-[10px] border-white/80 bg-[url('/brand/citrus-logo-mark.svg')] bg-contain bg-center bg-no-repeat" />
              </div>
              <div className="absolute bottom-0 left-0 h-28 w-full rounded-t-[60%] bg-[#ffb55d]/32" />
              <div className="absolute bottom-0 left-24 h-36 w-full rounded-t-[70%] bg-[#ff8b2c]/40" />
              <div className="absolute bottom-0 left-52 h-28 w-full rounded-t-[60%] bg-[#f7671b]/54" />
            </div>
          </div>

          <aside className="os-card p-6">
            <p className="os-label">Daily intent</p>
            <p className="mt-6 text-4xl leading-none text-[var(--accent)]">&ldquo;</p>
            <p className="mt-1 text-2xl font-semibold leading-snug text-[var(--foreground)]">
              Small daily improvements lead to stunning results.
            </p>
            <p className="mt-4 text-sm text-[var(--muted)]">Robin Sharma</p>
            <button className="os-secondary-button mt-8 h-12 px-5 text-sm font-semibold" type="button">
              Set New Intent
            </button>
            <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white/58 p-4 text-sm text-[var(--muted)]">
              <div className="flex items-center gap-2">
                <RefreshCcw size={15} className={dataLoading ? "animate-spin text-[var(--accent)]" : "text-[var(--accent)]"} />
                <span>{dataLoading ? "Refreshing..." : `Refreshed ${formatTime(lastRefresh)}`}</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="os-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Bot size={18} />
                  AI Brief
                </div>
                <h2 className="mt-2 text-2xl font-semibold">What matters for the rest of the day</h2>
              </div>
              <div className="flex flex-wrap gap-2">
              <button
                className="os-primary-button inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                disabled={briefLoading}
                onClick={generateAiBrief}
                type="button"
              >
                <Sparkles size={16} />
                {briefLoading ? "Generating..." : "Generate brief"}
              </button>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]"
                disabled={syncing}
                onClick={syncDailyData}
                type="button"
              >
                <RefreshCcw size={16} />
                {syncing ? "Syncing..." : "Sync day"}
              </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {(aiBrief?.focus_items?.length ? aiBrief.focus_items : briefItems).slice(0, 3).map((item) => (
                <div key={item.label} className={`rounded-[1.5rem] border p-4 ${toneClass(item.tone)}`}>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="os-card-soft mt-5 p-4">
              <p className="text-sm font-medium text-[var(--muted)]">Recommended next action</p>
              <p className="mt-2 text-lg font-semibold">
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
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
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

          <div className="os-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              <DatabaseZap size={18} />
              Data connections
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["Gmail", "Live", Mail],
                ["Google Calendar", "Live", CalendarDays],
                ["Market data", "Live", Gauge],
                ["Project memory", "Live", Bell],
              ].map(([label, status, Icon]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3"
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
            <div className="mt-4">
              <IntegrationStatus onSynced={loadLiveData} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <div key={metric.label} className="os-card p-5">
              <div className="os-icon-bubble flex h-12 w-12 items-center justify-center">
                <metric.icon size={20} />
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">{metric.label}</p>
              <p className="mt-1 text-3xl font-semibold">{metric.value}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{metric.detail}</p>
            </div>
          ))}
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
        <section className="grid gap-5 lg:grid-cols-[0.9fr_1fr_0.7fr]">
          <ProgressCard />
          <QuickCaptureCard />
          <EnergyCard />
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
    <section className="os-card p-5">
      <div className="mb-4 flex items-center justify-between">
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

function ProgressCard() {
  return (
    <section className="os-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        <Target size={18} />
        Task Progress
      </div>
      <div className="mt-6 flex items-center gap-6">
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(var(--accent)_0_72%,rgba(244,126,22,0.16)_72%_100%)]">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[var(--surface)]">
            <span className="text-3xl font-semibold">72%</span>
            <span className="text-xs text-[var(--muted)]">Completed</span>
          </div>
        </div>
        <div className="grid gap-3 text-sm">
          <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[var(--secondary)]" />Completed 18</p>
          <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />In Progress 6</p>
          <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[var(--surface-warm)]" />Pending 11</p>
        </div>
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">35 tasks total <span className="ml-4 font-semibold text-[var(--secondary)]">+12% from last week</span></p>
    </section>
  );
}

function QuickCaptureCard() {
  return (
    <section className="os-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        <Sparkles size={18} />
        Quick Capture
      </div>
      <div className="mt-5 flex gap-2">
        <input className="os-input h-12 min-w-0 flex-1 px-4 text-sm" placeholder="Capture a task, note, thought, or event..." />
        <button className="os-primary-button flex h-12 w-12 shrink-0 items-center justify-center" type="button">
          <Sparkles size={18} />
        </button>
      </div>
      <div className="mt-5 grid gap-3 text-sm">
        {["Review ledger pacing", "Call contractor about photos", "Draft project update"].map((note, index) => (
          <div className="flex justify-between gap-3" key={note}>
            <span>{note}</span>
            <span className="text-[var(--muted)]">{index === 0 ? "Today" : "Soon"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EnergyCard() {
  return (
    <section className="os-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        <Activity size={18} />
        Energy
      </div>
      <div className="mx-auto mt-6 flex h-36 w-36 items-center justify-center rounded-full bg-[conic-gradient(var(--accent)_0_82%,rgba(244,126,22,0.14)_82%_100%)]">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[var(--surface)]">
          <span className="text-4xl font-semibold">82</span>
          <span className="text-sm text-[var(--muted)]">Great</span>
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">Energy trend <span className="font-semibold text-[var(--secondary)]">+12% from yesterday</span></p>
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
