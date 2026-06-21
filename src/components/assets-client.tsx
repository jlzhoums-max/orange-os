"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, CreditCard, Home, LineChart, Plus, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeNetWorth } from "@/lib/ledger/calc";
import type { LedgerAccount } from "@/lib/ledger/types";
import type { TrackerProject } from "@/lib/dashboard-data";

type AssetRow = {
  label: string;
  detail: string;
  amount: string;
  initials?: string;
  icon?: LucideIcon;
  change?: string;
  negative?: boolean;
  hot?: boolean;
};

type AssetGroup = {
  title: string;
  total: string;
  icon: LucideIcon;
  tone: "green" | "orange" | "red";
  rows: AssetRow[];
};

type LedgerData = {
  accounts: LedgerAccount[];
};

type ProjectsData = {
  projects: TrackerProject[];
};

const fallbackGroups: AssetGroup[] = [
  {
    title: "Cash",
    total: "$33,020",
    icon: WalletCards,
    tone: "green",
    rows: [
      { label: "Checking", detail: "Chase - 2841", amount: "$8,420", initials: "CB" },
      { label: "High-yield savings", detail: "Ally - 4.2% APY", amount: "$24,600", initials: "HY" },
    ],
  },
  {
    title: "Investments",
    total: "$197,400",
    icon: LineChart,
    tone: "green",
    rows: [
      { label: "Brokerage", detail: "Fidelity - stocks & ETFs", amount: "$52,300", initials: "BR", change: "+1.8%" },
      { label: "401(k)", detail: "Vanguard - retirement", amount: "$138,900", initials: "RT", change: "+0.9%" },
      { label: "Crypto", detail: "Coinbase", amount: "$6,200", initials: "B", change: "-3.1%", negative: true },
    ],
  },
  {
    title: "Property equity",
    total: "$394,000",
    icon: Home,
    tone: "orange",
    rows: [
      { label: "Maple St", detail: "$730k value - $420k mortgage", amount: "$310,000", icon: Home, hot: true },
      { label: "Oak Ave", detail: "Flip - est. equity", amount: "$84,000", icon: Home, hot: true },
    ],
  },
  {
    title: "Liabilities",
    total: "-$421,240",
    icon: CreditCard,
    tone: "red",
    rows: [
      { label: "Maple St mortgage", detail: "First National - 6.1%", amount: "-$420,000", icon: Home, negative: true },
      { label: "Credit card", detail: "Amex - due Jul 5", amount: "-$1,240", icon: CreditCard, negative: true },
    ],
  },
];

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
    style: "currency",
  }).format(value || 0);
}

function initials(label: string) {
  return label
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function accountDetail(account: LedgerAccount) {
  return [account.institution, account.type.replaceAll("_", " ")].filter(Boolean).join(" - ");
}

function buildLiveGroups(accounts: LedgerAccount[], projects: TrackerProject[]): AssetGroup[] {
  const cash = accounts.filter((account) => account.category === "cash");
  const investments = accounts.filter((account) => account.category === "investment");
  const propertyRows = projects.slice(0, 4).map((project) => {
    const equity = Math.max(0, project.estimatedValue - project.purchasePrice);
    return {
      label: project.name,
      detail: `${money(project.estimatedValue, true)} value - ${project.status}`,
      amount: money(equity),
      icon: Home,
      hot: true,
    };
  });

  const netWorth = computeNetWorth(accounts);
  const propertyTotal = projects.reduce((total, project) => total + Math.max(0, project.estimatedValue - project.purchasePrice), 0);

  const nextGroups: AssetGroup[] = [
    {
      title: "Cash",
      total: money(netWorth.cash),
      icon: WalletCards,
      tone: "green",
      rows: cash.map((account) => ({
        label: account.name,
        detail: accountDetail(account),
        amount: money(account.balance),
        initials: initials(account.name),
      })),
    },
    {
      title: "Investments",
      total: money(netWorth.investments),
      icon: LineChart,
      tone: "green",
      rows: investments.map((account) => ({
        label: account.name,
        detail: accountDetail(account),
        amount: money(account.balance),
        initials: initials(account.name),
      })),
    },
    {
      title: "Property equity",
      total: money(propertyTotal),
      icon: Home,
      tone: "orange",
      rows: propertyRows,
    },
  ];

  return nextGroups.filter((group) => group.rows.length > 0);
}

export function AssetsClient() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [projects, setProjects] = useState<TrackerProject[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      try {
        const [ledgerResponse, projectsResponse] = await Promise.all([
          fetch("/api/ledger/data", { cache: "no-store" }),
          fetch("/api/real-estate/projects", { cache: "no-store" }),
        ]);
        const ledgerPayload = ledgerResponse.ok ? ((await ledgerResponse.json()) as LedgerData) : { accounts: [] };
        const projectPayload = projectsResponse.ok ? ((await projectsResponse.json()) as ProjectsData) : { projects: [] };

        setAccounts(ledgerPayload.accounts ?? []);
        setProjects(projectPayload.projects ?? []);
      } finally {
        setLoaded(true);
      }
    }

    void loadAssets();
  }, []);

  const liveGroups = useMemo(() => buildLiveGroups(accounts, projects), [accounts, projects]);
  const groups = liveGroups.length ? liveGroups : fallbackGroups;
  const liveAssetsTotal =
    computeNetWorth(accounts).total +
    projects.reduce((total, project) => total + Math.max(0, project.estimatedValue - project.purchasePrice), 0);
  const assetsTotal = liveGroups.length ? liveAssetsTotal : 624420;
  const liabilities = liveGroups.length ? 0 : -421240;
  const netWorth = assetsTotal + liabilities;
  const accountCount = accounts.length + projects.length;

  return (
    <section className="pb-36 md:pb-8">
      <header className="mb-[22px] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-normal text-[var(--foreground)] md:text-[25px]">Assets</h1>
          <p className="mt-[3px] hidden text-[13.5px] font-semibold text-[var(--muted-soft)] md:block">
            {loaded && liveGroups.length ? `${accountCount} accounts and properties` : "7 accounts across cash, investments & property"}
          </p>
        </div>
        <Link className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-white shadow-[0_6px_16px_rgba(224,70,26,.26)] transition hover:-translate-y-0.5 md:h-11 md:w-auto md:gap-2 md:px-[18px]" href="/ledger">
          <Plus size={19} strokeWidth={2.4} />
          <span className="hidden text-sm font-extrabold md:inline">Add account</span>
        </Link>
      </header>

      <section className="mb-3.5 rounded-[22px] bg-gradient-to-br from-[#F4831C] via-[#EC5C18] to-[#E0461A] p-5 shadow-[0_10px_26px_rgba(224,70,26,.28)] md:mb-[22px] md:rounded-[24px] md:p-[26px_30px] md:shadow-[0_12px_34px_rgba(224,70,26,.24)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#FFE3CC] md:text-[11.5px] md:tracking-[0.06em]">Net worth</p>
            <p className="mt-[5px] font-mono text-[32px] font-medium leading-none text-white md:mt-1.5 md:text-[40px]">{money(netWorth)}</p>
            <p className="mt-[11px] inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-bold text-white md:mt-3 md:px-3 md:text-[12.5px]">
              <ArrowUp size={13} strokeWidth={2.6} />
              <span>{loaded && liveGroups.length ? "Synced from Ledger" : "+2.4% this month"}</span>
            </p>
          </div>
          <div className="hidden gap-3.5 md:flex">
            <HeroStat label="Assets" value={money(assetsTotal)} />
            <HeroStat label="Liabilities" value={money(liabilities)} light negative={liabilities < 0} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <AssetGroupCard group={group} key={group.title} />
        ))}
      </div>
    </section>
  );
}

function HeroStat({ label, value, light = false, negative = false }: { label: string; value: string; light?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-2xl px-5 py-4 ${light ? "bg-white" : "bg-white/15"}`}>
      <p className={`text-xs font-bold ${light ? "text-[var(--muted-soft)]" : "text-[#FFE3CC]"}`}>{label}</p>
      <p className={`mt-1 font-mono text-xl font-medium ${negative ? "text-[#C24A12]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function AssetGroupCard({ group }: { group: AssetGroup }) {
  const Icon = group.icon;
  const red = group.tone === "red";
  const orange = group.tone === "orange";
  return (
    <section className={`rounded-[18px] border bg-white p-4 shadow-[0_6px_16px_rgba(90,55,20,.04)] md:rounded-[22px] md:p-[22px] md:shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)] ${red ? "border-[#F4D9BE]" : "border-[var(--line)]"}`}>
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`hidden h-[30px] w-[30px] items-center justify-center rounded-[9px] md:flex ${red ? "bg-[#FCEBDD] text-[#C24A12]" : orange ? "bg-[#FCEBDD] text-[#E0461A]" : "bg-[#E6F0E5] text-[#2E7D52]"}`}>
            <Icon size={16} strokeWidth={2} />
          </span>
          <h2 className="text-sm font-extrabold text-[var(--foreground)] md:text-[15.5px]">{group.title}</h2>
        </div>
        <span className={`font-mono text-[12.5px] font-medium md:text-sm ${red ? "text-[#C24A12]" : "text-[var(--foreground)]"}`}>{group.total}</span>
      </div>
      <div className="grid">
        {group.rows.map((row) => (
          <AssetRowItem key={row.label} row={row} />
        ))}
      </div>
    </section>
  );
}

function AssetRowItem({ row }: { row: AssetRow }) {
  const Icon = row.icon;
  return (
    <button className="flex w-full items-center gap-2.5 rounded-[11px] px-0.5 py-2 text-left transition hover:bg-[#FBF6EC] md:gap-3 md:px-2 md:py-2.5" type="button">
      <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-extrabold md:h-[34px] md:w-[34px] md:rounded-[10px] md:text-[13px] ${row.negative ? "bg-[#F8E2D0] text-[#C24A12]" : row.hot ? "bg-[#FCEBDD] text-[#E0461A]" : "bg-[#F1E8D8] text-[#8B7A57]"}`}>
        {Icon ? <Icon size={16} strokeWidth={2} /> : row.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-[var(--foreground)] md:text-[13.5px]">{row.label}</span>
        <span className="block truncate text-[10.5px] font-semibold text-[var(--muted-soft)] md:text-[11.5px]">{row.detail}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block font-mono text-[12.5px] font-medium md:text-[13.5px] ${row.negative ? "text-[#C24A12]" : "text-[#42392E]"}`}>{row.amount}</span>
        {row.change ? <span className={`block text-[11px] font-bold ${row.negative ? "text-[#C24A12]" : "text-[#2E7D52]"}`}>{row.change}</span> : null}
      </span>
    </button>
  );
}
