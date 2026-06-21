"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  Home,
  ListTodo,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import {
  calendarItems,
  inboxItems,
  marketItems,
  type CalendarItem,
  type DayPart,
  type InboxItem,
  type MarketItem,
} from "@/lib/dashboard-data";

function getDayPart(date: Date): DayPart {
  const hour = date.getHours();

  if (hour < 11) return "morning";
  if (hour < 17) return "midday";
  if (hour < 21) return "evening";
  return "night";
}

function greetingFor(dayPart: DayPart) {
  if (dayPart === "midday") return "Good afternoon";
  if (dayPart === "evening") return "Good evening";
  if (dayPart === "night") return "Good night";
  return "Good morning";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatEventTime(value: string | null) {
  if (!value) return "TBD";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOverviewDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function inboxUrgency(labels: string[]): InboxItem["urgency"] {
  if (labels.includes("IMPORTANT")) return "High";
  if (labels.includes("UNREAD")) return "Medium";
  return "Low";
}

function senderName(sender: string | null) {
  if (!sender) return "Unknown sender";
  return sender.replace(/\s*<[^>]+>/, "");
}

function formatMoneyCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function progressWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function varianceLabel(value: number) {
  return `${formatMoneyCompact(Math.abs(value))} ${value >= 0 ? "under budget" : "over budget"}`;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "J";
}

type DashboardClientProps = {
  initialTimestamp: string;
};

type LiveLedgerSummary = {
  hasData: boolean;
  monthLabel: string;
  savingsRate: number | null;
  savingsTarget: number;
  weeklySpent: number;
  weeklyTarget: number;
  monthlySpent: number;
  monthlyTarget: number;
};

type LiveRealEstateProject = {
  id: string;
  name: string;
  spent: number;
  total: number;
  progress: number;
  variance: number;
  good: boolean;
};

type LiveRealEstateSummary = {
  hasData: boolean;
  statusLabel: string;
  projects: LiveRealEstateProject[];
};

type LiveTodoSummary = {
  total: number;
  open: number;
  completed: number;
  todayOpen: number;
  tasks: Array<{
    id: string;
    title: string;
    project: string;
    dueDate: string | null;
    amount: string | null;
    flagged: boolean;
  }>;
};

type LiveDashboardData = {
  profile?: {
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  };
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
  ledger?: LiveLedgerSummary;
  realEstate?: LiveRealEstateSummary;
  todos?: LiveTodoSummary;
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
const fallbackLedgerSummary: LiveLedgerSummary = {
  hasData: false,
  monthLabel: "June",
  savingsRate: 34,
  savingsTarget: 0,
  weeklySpent: 640,
  weeklyTarget: 750,
  monthlySpent: 3200,
  monthlyTarget: 3400,
};
const fallbackRealEstateSummary: LiveRealEstateSummary = {
  hasData: false,
  statusLabel: "On track",
  projects: [
    {
      id: "maple-st-reno",
      name: "Maple St Reno",
      spent: 68200,
      total: 80000,
      progress: 85,
      variance: 11800,
      good: true,
    },
    {
      id: "oak-ave-flip",
      name: "Oak Ave Flip",
      spent: 54600,
      total: 52000,
      progress: 100,
      variance: -2600,
      good: false,
    },
  ],
};
const fallbackTodoSummary: LiveTodoSummary = {
  total: 5,
  open: 3,
  completed: 2,
  todayOpen: 1,
  tasks: [
    { id: "insurance", title: "Pay home insurance premium", project: "Finance", dueDate: null, amount: "$2,400", flagged: true },
    { id: "lender", title: "Reply to lender re: rate lock", project: "Real Estate", dueDate: null, amount: null, flagged: false },
    { id: "tile", title: "Confirm tile order for Maple St", project: "Real Estate", dueDate: null, amount: null, flagged: false },
  ],
};

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
      setSyncMessage(`Synced ${gmailData.synced ?? 0} emails and ${calendarData.synced ?? 0} calendar events.`);
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
    if (!liveData?.emails.length) return inboxItems;

    return liveData.emails.slice(0, 3).map((email) => ({
      from: senderName(email.sender),
      subject: email.subject ?? "No subject",
      urgency: inboxUrgency(email.labels ?? []),
      summary: email.snippet ?? "No preview available.",
    }));
  }, [liveData]);

  const liveCalendarItems = useMemo<CalendarItem[]>(() => {
    if (!liveData?.events.length) return calendarItems;

    return liveData.events.slice(0, 4).map((event) => ({
      time: formatEventTime(event.starts_at),
      title: event.title ?? "Untitled event",
      context: event.location ? `Location: ${event.location}` : "Synced from Google Calendar.",
    }));
  }, [liveData]);

  const liveMarketItems = useMemo<MarketItem[]>(() => {
    if (!liveData?.quotes.length) return marketItems;

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
  const ledgerSummary = liveData?.ledger?.hasData ? liveData.ledger : fallbackLedgerSummary;
  const realEstateSummary = liveData?.realEstate?.hasData ? liveData.realEstate : fallbackRealEstateSummary;
  const todoSummary = liveData?.todos ?? fallbackTodoSummary;
  const profileName = liveData?.profile?.fullName?.trim() || "Ju";
  const profileInitials = initialsFor(profileName);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const refreshTimer = window.setInterval(() => setLastRefresh(new Date()), 60000);

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
      if (Date.now() - lastAutoSync < autoSyncCooldownMs) return;

      window.sessionStorage.setItem(autoSyncStorageKey, String(Date.now()));
      void syncDailyData();
    }, 800);

    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(syncTimer);
    };
  }, [loadAiBrief, loadLiveData, syncDailyData]);

  const briefHeadline =
    aiBrief?.headline ??
    "A lighter Saturday. The renovation walkthrough is the one thing that truly matters today - the rest can wait.";
  const unreadCount = String(liveData?.emails.length ?? 12);
  const nextUp = liveCalendarItems[0] ? `${liveCalendarItems[0].time} · ${liveCalendarItems[0].title}` : "11:00 · Walkthrough";
  const priorities = (aiBrief?.suggested_tasks?.length
    ? aiBrief.suggested_tasks.map((task) => task.title)
    : ["Renovation walkthrough at Maple St - 11:00 AM", "Reply to lender about the rate lock", "Pay quarterly home insurance - due today"]
  ).slice(0, 3);

  return (
    <AppChrome active="overview">
      <div className="mx-auto flex max-w-[1158px] flex-col gap-[22px]">
        <header className="hidden flex-col gap-4 md:flex md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[25px] font-extrabold tracking-normal text-[var(--foreground)]">
              {greetingFor(dayPart)}, {profileName}
            </h1>
            <p className="mt-[3px] text-[13.5px] font-semibold text-[var(--muted-soft)]">
              {formatOverviewDate(now)} · A sweeter day ahead
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden w-60 items-center gap-2 rounded-[13px] border border-[var(--line)] bg-white px-3.5 py-[9px] text-[13.5px] text-[#A99B82] md:flex">
              <Search size={17} strokeWidth={2} />
              <input className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-[#A99B82]" placeholder="Search JU OS" />
            </label>
            <button
              aria-label="Sync daily data"
              className="relative flex h-[42px] w-[42px] items-center justify-center rounded-[13px] border border-[var(--line)] bg-white text-[var(--muted)] disabled:cursor-wait disabled:opacity-70"
              disabled={syncing}
              onClick={syncDailyData}
              title={`Last refreshed ${formatTime(lastRefresh)}`}
              type="button"
            >
              {syncing || dataLoading ? <RefreshCcw size={18} className="animate-spin text-[var(--accent-hot)]" /> : <Bell size={19} strokeWidth={1.9} />}
              <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#F0563B]" />
            </button>
          </div>
        </header>

        <MobileOverview
          inboxItems={liveInboxItems}
          ledgerSummary={ledgerSummary}
          priorities={priorities}
          profileInitials={profileInitials}
          profileName={profileName}
          realEstateSummary={realEstateSummary}
          todoSummary={todoSummary}
          unreadCount={unreadCount}
        />

        <section className="relative hidden overflow-hidden rounded-[24px] bg-[linear-gradient(125deg,#F4831C_0%,#EC5C18_55%,#E0461A_100%)] p-[26px_28px] shadow-[0_12px_34px_rgba(224,70,26,.26)] md:block">
          <div className="pointer-events-none absolute -right-12 -top-14 h-[300px] w-[300px] rounded-full bg-[url('/brand/citrus-logo-mark-1024.png')] bg-contain bg-center bg-no-repeat opacity-[0.14] brightness-0 invert" />
          <div className="relative flex gap-[30px]">
            <div className="flex-[1.35]">
              <button className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-[11px] py-[5px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-white backdrop-blur disabled:cursor-wait disabled:opacity-80" disabled={briefLoading} onClick={generateAiBrief} type="button">
                <Sparkles size={14} fill="currentColor" />
                AI Brief
              </button>
              <p className="mt-3.5 max-w-[430px] text-[21px] font-bold leading-[1.4] text-[#FFF6EC]">
                {briefHeadline}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <HeroPill label="Unread" value={unreadCount} />
                <HeroPill label="Next up" value={nextUp} />
                <div className="flex items-center gap-2 rounded-[11px] bg-white px-3 py-2">
                  <AlertTriangle size={13} strokeWidth={2.4} className="text-[var(--accent-hot)]" />
                  <span className="text-[13px] font-extrabold text-[var(--accent-ink)]">$2,400 insurance due</span>
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-[18px] border border-white/20 bg-white/15 p-[16px_18px] backdrop-blur-sm">
              <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#FFE3CC]">
                Top 3 priorities
              </div>
              <div className="flex flex-col gap-2.5">
                {priorities.map((item, index) => (
                    <div className="flex items-start gap-[11px]" key={item}>
                      <span className="mt-px flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-[7px] bg-white text-xs font-extrabold text-[var(--accent-hot)]">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold leading-[1.4] text-[#FFF6EC]">{item}</span>
                    </div>
                  ))}
              </div>
              <div className="mt-3 flex gap-2 border-t border-white/20 pt-3 text-[12.5px] font-semibold leading-[1.4] text-[#FFE3CC]">
                <Clock size={15} className="mt-0.5 shrink-0" />
                <span>{syncMessage ?? briefError ?? "Suggested focus - block 2-4 PM for a Ledger review before month-end."}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="hidden md:block">
          <QuickCaptureCard />
        </div>

        <section className="hidden gap-5 md:grid xl:grid-cols-[1.32fr_1fr]">
          <div className="flex flex-col gap-5">
            <ScheduleCard items={liveCalendarItems} />
            <RealEstateSummary summary={realEstateSummary} />
          </div>
          <div className="flex flex-col gap-5">
            <InboxCard items={liveInboxItems} />
            <TodoCard summary={todoSummary} />
            <MarketCard items={liveMarketItems} />
          </div>
        </section>
      </div>
    </AppChrome>
  );
}

function MobileOverview({
  inboxItems,
  ledgerSummary,
  priorities,
  profileInitials,
  profileName,
  realEstateSummary,
  todoSummary,
  unreadCount,
}: {
  inboxItems: InboxItem[];
  ledgerSummary: LiveLedgerSummary;
  priorities: string[];
  profileInitials: string;
  profileName: string;
  realEstateSummary: LiveRealEstateSummary;
  todoSummary: LiveTodoSummary;
  unreadCount: string;
}) {
  const repliesNeeded = Math.min(2, inboxItems.length || 2);

  return (
    <div className="grid gap-3.5 md:hidden">
      <header className="flex items-center justify-between px-0.5 pb-0.5 pt-2">
        <div className="flex items-center gap-2.5">
          <Image alt="JU OS" height={30} src="/brand/citrus-logo-mark-512.png" width={30} />
          <div className="leading-none">
            <p className="text-[11px] font-bold text-[#A99B82]">Good morning</p>
            <h1 className="mt-[3px] text-lg font-extrabold tracking-normal text-[var(--foreground)]">{profileName}</h1>
          </div>
        </div>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-base font-extrabold text-white">
          {profileInitials}
          <span className="absolute right-0 top-0 h-[11px] w-[11px] rounded-full border-2 border-[var(--background)] bg-[#F0563B]" />
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#F4831C,#EC5C18_60%,#E0461A)] p-[18px] shadow-[0_10px_26px_rgba(224,70,26,.28)]">
        <div className="pointer-events-none absolute -right-10 -top-11 h-[170px] w-[170px] rounded-full bg-[url('/brand/citrus-logo-mark-1024.png')] bg-contain bg-center bg-no-repeat opacity-[0.14] brightness-0 invert" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-white">
            <Sparkles size={12} fill="currentColor" />
            AI Brief
          </div>
          <p className="mt-3 text-base font-bold leading-[1.45] text-[#FFF6EC]">A lighter Saturday. The renovation walkthrough is the one thing that truly matters today.</p>
          <div className="mt-[15px] flex flex-col gap-2">
            {priorities.slice(0, 3).map((item, index) => (
              <div className="flex items-center gap-2.5" key={item}>
                <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-extrabold text-[var(--accent-hot)]">{index + 1}</span>
                <span className="text-[13px] font-semibold text-[#FFF6EC]">{item.replace(" at Maple St - 11:00 AM", " - 11:00 AM").replace("about the", "re:")}</span>
              </div>
            ))}
          </div>
          <div className="mt-[15px] flex flex-wrap gap-2">
            <span className="rounded-[10px] bg-white/15 px-2.5 py-1.5 text-xs font-bold text-white">{unreadCount} unread</span>
            <span className="rounded-[10px] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[var(--accent-ink)]">$2,400 flagged</span>
          </div>
        </div>
      </section>

      <section className="os-card rounded-[20px] p-4 shadow-[0_8px_20px_rgba(90,55,20,.05)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[27px] w-[27px] items-center justify-center rounded-lg bg-[var(--panel-strong)] text-[var(--accent-hot)]"><CalendarDays size={15} /></span>
            <h2 className="text-[14.5px] font-bold">Today</h2>
          </div>
          <span className="text-xs font-bold text-[var(--muted-soft)]">4 events</span>
        </div>
        <MobileEvent time="11:00" period="AM" title="Renovation walkthrough" detail="Maple St - 90 min" active />
        <MobileEvent time="2:00" period="PM" title="Ledger review" detail="Focus block - 2 hrs" />
      </section>

      <div className="grid grid-cols-2 gap-3.5">
        <MobileSummary icon={Mail} value={unreadCount} label="Unread emails" detail={`${repliesNeeded} need a reply ->`} hot />
        <MobileSummary icon={ListTodo} value={`${todoSummary.open}/${todoSummary.total || todoSummary.open}`} label="Tasks left" detail={`${todoSummary.todayOpen} due today ->`} />
      </div>

      <MobileLedger summary={ledgerSummary} />
      <MobileRealEstate summary={realEstateSummary} />
    </div>
  );
}

function MobileEvent({ time, period, title, detail, active = false }: { time: string; period: string; title: string; detail: string; active?: boolean }) {
  return (
    <div className={`mb-[3px] flex gap-3 rounded-[11px] p-[9px] ${active ? "bg-[#FFF4E9]" : ""}`}>
      <div className="w-[46px] shrink-0 text-right">
        <p className={`text-[13px] font-extrabold ${active ? "text-[var(--accent-hot)]" : "text-[var(--foreground)]"}`}>{time}</p>
        <p className={`text-[10px] font-semibold ${active ? "text-[#E08A4E]" : "text-[var(--muted-faint)]"}`}>{period}</p>
      </div>
      <div className={`w-[3px] shrink-0 rounded-full ${active ? "bg-[var(--accent)]" : "bg-[#7FB89A]"}`} />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-bold text-[var(--foreground)]">{title}</p>
        <p className="mt-px truncate text-xs font-medium text-[var(--muted-soft)]">{detail}</p>
      </div>
    </div>
  );
}

function MobileSummary({ icon: Icon, value, label, detail, hot = false }: { icon: typeof Mail; value: string; label: string; detail: string; hot?: boolean }) {
  return (
    <section className="os-card rounded-[20px] p-4 shadow-[0_8px_20px_rgba(90,55,20,.05)]">
      <span className={`flex h-[27px] w-[27px] items-center justify-center rounded-lg ${hot ? "bg-[var(--panel-strong)] text-[var(--accent-hot)]" : "bg-[var(--secondary-container)] text-[var(--secondary)]"}`}>
        <Icon size={15} />
      </span>
      <p className="mt-[11px] text-[26px] font-extrabold leading-none text-[var(--foreground)]">
        {value.includes("/") ? (
          <>
            {value.split("/")[0]}<span className="text-base text-[var(--muted-faint)]">/{value.split("/")[1]}</span>
          </>
        ) : value}
      </p>
      <p className="mt-1 text-[12.5px] font-semibold text-[var(--muted-soft)]">{label}</p>
      <p className={`mt-2 text-[11.5px] font-bold ${hot ? "text-[var(--accent-ink)]" : "text-[var(--secondary)]"}`}>{detail}</p>
    </section>
  );
}

function MobileLedger({ summary }: { summary: LiveLedgerSummary }) {
  const savingsRate = summary.savingsRate ?? 0;
  const weeklyWidth = summary.weeklyTarget > 0 ? progressWidth((summary.weeklySpent / summary.weeklyTarget) * 100) : "0%";
  const monthlyWidth = summary.monthlyTarget > 0 ? progressWidth((summary.monthlySpent / summary.monthlyTarget) * 100) : "0%";

  return (
    <section className="os-card rounded-[20px] p-4 shadow-[0_8px_20px_rgba(90,55,20,.05)]">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[27px] w-[27px] items-center justify-center rounded-lg bg-[var(--secondary-container)] text-[var(--secondary)]">
            <Sparkles size={15} />
          </span>
          <h2 className="text-[14.5px] font-bold text-[var(--foreground)]">The Ledger</h2>
        </div>
        <span className="text-xs font-bold text-[var(--muted-soft)]">{summary.monthLabel}</span>
      </div>
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#3E9E66 0% ${Math.max(0, Math.min(100, savingsRate))}%, #EDE3D0 ${Math.max(0, Math.min(100, savingsRate))}% 100%)` }}
        >
          <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-white">
            <span className="text-lg font-extrabold leading-none text-[var(--secondary)]">{savingsRate}%</span>
            <span className="text-[9px] font-bold text-[var(--muted-soft)]">saved</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MobileProgress label="Week" value={`${formatMoneyCompact(summary.weeklySpent)}/${formatMoneyCompact(summary.weeklyTarget)}`} width={weeklyWidth} green />
          <MobileProgress label="Month" value={`${formatMoneyCompact(summary.monthlySpent)}/${formatMoneyCompact(summary.monthlyTarget)}`} width={monthlyWidth} />
        </div>
      </div>
    </section>
  );
}

function MobileRealEstate({ summary }: { summary: LiveRealEstateSummary }) {
  const projects = summary.projects.slice(0, 2);

  return (
    <section className="os-card rounded-[20px] p-4 shadow-[0_8px_20px_rgba(90,55,20,.05)]">
      <div className="mb-[13px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[27px] w-[27px] items-center justify-center rounded-lg bg-[var(--panel-strong)] text-[var(--accent-hot)]">
            <Home size={15} />
          </span>
          <h2 className="text-[14.5px] font-bold text-[var(--foreground)]">Real Estate</h2>
        </div>
        <span className={`flex items-center gap-1.5 text-[11.5px] font-bold ${summary.statusLabel === "On track" ? "text-[var(--secondary)]" : "text-[var(--accent-ink)]"}`}>
          <span className={`h-[7px] w-[7px] rounded-full ${summary.statusLabel === "On track" ? "bg-[var(--positive)]" : "bg-[var(--accent-hot)]"}`} />
          {summary.statusLabel}
        </span>
      </div>
      {projects.map((project) => (
        <MobileProjectProgress
          good={project.good}
          key={project.id}
          status={varianceLabel(project.variance).replace(" budget", "")}
          title={project.name}
          width={progressWidth(project.progress)}
        />
      ))}
    </section>
  );
}

function MobileProgress({ label, value, width, green = false }: { label: string; value: string; width: string; green?: boolean }) {
  return (
    <div className="mb-[11px] last:mb-0">
      <div className="mb-1 flex justify-between">
        <span className="text-[11.5px] font-bold text-[var(--muted)]">{label}</span>
        <span className="font-mono text-[11px] text-[#8B8173]">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-[#EDE3D0]">
        <div className={`h-full rounded ${green ? "bg-[var(--secondary)]" : "bg-[linear-gradient(90deg,#F47E16,#EC5C18)]"}`} style={{ width }} />
      </div>
    </div>
  );
}

function MobileProjectProgress({ title, status, width, good = false }: { title: string; status: string; width: string; good?: boolean }) {
  return (
    <div className="mb-[11px] last:mb-0">
      <div className="mb-[5px] flex justify-between gap-2">
        <span className="text-[12.5px] font-bold text-[var(--foreground)]">{title}</span>
        <span className={`text-[11.5px] font-bold ${good ? "text-[var(--secondary)]" : "text-[var(--accent-ink)]"}`}>{status}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded bg-[#EDE3D0]">
        <div className={`h-full rounded ${good ? "bg-[linear-gradient(90deg,#F47E16,#EC5C18)]" : "bg-[linear-gradient(90deg,#F0563B,#E0461A)]"}`} style={{ width }} />
      </div>
    </div>
  );
}

function HeroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[11px] bg-white/15 px-3 py-2">
      <span className="text-xs font-semibold text-[#FFE3CC]">{label}</span>
      <span className="text-sm font-extrabold text-white">{value}</span>
    </div>
  );
}

function QuickCaptureCard() {
  const [type, setType] = useState<"Note" | "Task" | "Event">("Note");
  const [text, setText] = useState("");
  const [items, setItems] = useState<Array<{ id: string; type: "Note" | "Task" | "Event"; text: string }>>([]);

  function capture() {
    const value = text.trim();
    if (!value) return;
    setItems((current) => [{ id: `${Date.now()}`, type, text: value }, ...current].slice(0, 3));
    setText("");
  }

  return (
    <section className="os-card p-5">
      <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="os-icon-bubble flex h-[30px] w-[30px] items-center justify-center">
            <Pencil size={16} />
          </span>
          <div>
            <h2 className="text-[15.5px] font-bold text-[var(--foreground)]">Quick Capture</h2>
            <p className="mt-px text-xs font-semibold text-[var(--muted-soft)]">Jot a note, task or event - sort it later</p>
          </div>
        </div>
        <div className="flex gap-[7px]">
          {(["Note", "Task", "Event"] as const).map((nextType) => (
            <button
              className={`rounded-[9px] px-3 py-1.5 text-xs font-bold transition ${
                type === nextType ? "bg-[var(--panel-strong)] text-[var(--accent-ink)]" : "bg-[#F4ECDD] text-[#9A8E78]"
              }`}
              key={nextType}
              onClick={() => setType(nextType)}
              type="button"
            >
              {nextType}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="os-input min-h-[62px] w-full resize-none px-3.5 py-3 text-sm font-medium"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") capture();
        }}
        placeholder="Capture anything on your mind..."
        value={text}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--muted-faint)]">Cmd + Enter to capture</span>
        <button className="os-primary-button flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-bold" onClick={capture} type="button">
          <Plus size={15} />
          Capture
        </button>
      </div>
      {items.length ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
          {items.map((item) => (
            <div className="flex items-center gap-3 rounded-[11px] px-2.5 py-2 hover:bg-[#FBF6EC]" key={item.id}>
              <span className="w-12 rounded-lg bg-[var(--panel-strong)] py-1 text-center text-[10.5px] font-extrabold text-[var(--accent-ink)]">
                {item.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{item.text}</span>
              <button className="text-lg leading-none text-[#C4B79C]" onClick={() => setItems((current) => current.filter((next) => next.id !== item.id))} type="button">
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScheduleCard({ items }: { items: CalendarItem[] }) {
  const visible = items.slice(0, 4);

  return (
    <section className="os-card p-[22px]">
      <CardHeader icon={CalendarDays} title="Today's Schedule" meta={`${visible.length} events`} />
      <div className="mt-4 flex flex-col">
        {visible.map((event, index) => (
          <div className={`flex gap-3.5 rounded-xl p-2.5 ${index === 1 ? "bg-[#FFF4E9]" : "hover:bg-[#FBF6EC]"}`} key={`${event.time}-${event.title}`}>
            <div className="w-[54px] shrink-0 text-right">
              <div className={`text-[13.5px] font-extrabold ${index === 1 ? "text-[var(--accent-hot)]" : "text-[var(--foreground)]"}`}>{event.time}</div>
            </div>
            <div className={`w-[3px] shrink-0 rounded-full ${index === 1 ? "bg-[var(--accent)]" : "bg-[#7FB89A]"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--foreground)]">{event.title}</p>
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--muted-soft)]">{event.context}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RealEstateSummary({ summary }: { summary: LiveRealEstateSummary }) {
  return (
    <section className="os-card p-[22px]">
      <CardHeader icon={Home} title="Real Estate Projects" meta={summary.statusLabel} />
      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        {summary.projects.slice(0, 2).map((project) => (
          <ProjectMini
            good={project.good}
            key={project.id}
            progress={progressWidth(project.progress)}
            spent={formatMoneyCompact(project.spent)}
            status={varianceLabel(project.variance)}
            title={project.name}
            total={project.total > 0 ? formatMoneyCompact(project.total) : "No budget"}
          />
        ))}
      </div>
    </section>
  );
}

function ProjectMini({
  title,
  spent,
  total,
  progress,
  status,
  good,
}: {
  title: string;
  spent: string;
  total: string;
  progress: string;
  status: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#FBF6EC] p-4">
      <p className="text-[13.5px] font-extrabold">{title}</p>
      <div className="mb-2 mt-3 flex items-baseline justify-between">
        <span className="font-mono text-[13px] font-medium text-[var(--muted)]">{spent}</span>
        <span className="text-[11.5px] font-semibold text-[var(--muted-soft)]">of {total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-[#EDE3D0]">
        <div
          className={`h-full rounded-md ${good ? "bg-[linear-gradient(90deg,#F47E16,#EC5C18)]" : "bg-[linear-gradient(90deg,#F0563B,#E0461A)]"}`}
          style={{ width: progress }}
        />
      </div>
      <p className={`mt-2 text-[11.5px] font-bold ${good ? "text-[var(--secondary)]" : "text-[var(--accent-ink)]"}`}>{status}</p>
    </div>
  );
}

function InboxCard({ items }: { items: InboxItem[] }) {
  return (
    <section className="os-card p-[22px]">
      <CardHeader icon={Mail} title="Inbox" meta={`${items.length} new`} hot />
      <div className="mt-3 flex flex-col">
        {items.slice(0, 3).map((item, index) => (
          <div className="flex items-start gap-[11px] rounded-xl p-2.5 hover:bg-[#FBF6EC]" key={`${item.from}-${item.subject}`}>
            <span className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${index < 2 ? "bg-[#F0563B]" : "bg-[#D8CDB6]"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <p className="truncate text-[13.5px] font-extrabold">{item.from}</p>
                <span className="shrink-0 text-[11.5px] font-semibold text-[var(--muted-faint)]">{item.urgency}</span>
              </div>
              <p className="mt-px truncate text-[13px] font-bold text-[#42392E]">{item.subject}</p>
              <p className="mt-px truncate text-[12.5px] font-medium text-[var(--muted-soft)]">{item.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodoCard({ summary }: { summary: LiveTodoSummary }) {
  const tasks = summary.tasks.length ? summary.tasks : fallbackTodoSummary.tasks;
  return (
    <section className="os-card p-[22px]">
      <CardHeader icon={ListTodo} title="To-Do" meta={`${summary.completed} of ${summary.total} done`} green />
      <div className="mt-3 flex flex-col gap-1">
        {tasks.map((task) => (
          <div className="flex items-center gap-[11px] rounded-[11px] px-2.5 py-2 hover:bg-[#FBF6EC]" key={task.id}>
            <span className={`h-5 w-5 shrink-0 rounded-[7px] border-2 ${task.flagged ? "border-[var(--accent)]" : "border-[#D8CDB6]"}`} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{task.title}</span>
            {task.amount ? (
              <span className="rounded-lg bg-[var(--panel-strong)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--accent-ink)]">{task.amount}</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketCard({ items }: { items: MarketItem[] }) {
  return (
    <section className="os-card p-[22px]">
      <CardHeader icon={Sparkles} title="Market Watch" meta={`${items.length} tracked`} />
      <div className="mt-3 grid gap-2">
        {items.slice(0, 3).map((item) => (
          <div className="flex items-center justify-between rounded-xl bg-[#FBF6EC] px-3 py-2" key={item.symbol}>
            <div>
              <p className="font-mono text-sm font-medium">{item.symbol}</p>
              <p className="text-xs font-semibold text-[var(--muted-soft)]">{item.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{item.price}</p>
              <p className={`text-xs font-bold ${item.direction === "up" ? "text-[var(--secondary)]" : "text-[var(--danger)]"}`}>{item.change}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CardHeader({
  icon: Icon,
  title,
  meta,
  hot,
  green,
}: {
  icon: typeof CalendarDays;
  title: string;
  meta: string;
  hot?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-[9px] ${green ? "bg-[var(--secondary-container)] text-[var(--secondary)]" : "bg-[var(--panel-strong)] text-[var(--accent-hot)]"}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <h2 className="text-[15.5px] font-bold text-[var(--foreground)]">{title}</h2>
      </div>
      <span className={hot ? "rounded-[9px] bg-[#F0563B] px-2.5 py-0.5 text-[11.5px] font-extrabold text-white" : "text-[12.5px] font-bold text-[var(--muted-soft)]"}>
        {meta}
      </span>
    </div>
  );
}
