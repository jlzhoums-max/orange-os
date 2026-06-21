"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Home, Plus, Save, Settings, ShoppingBag, Trash2, Utensils, WalletCards, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  computeBucketTarget,
  computeMonthSpent,
  computeMonthlyTarget,
  computeNetWorth,
  computeWeekSpent,
  computeWeeklyTarget,
} from "@/lib/ledger/calc";
import { defaultLedgerSettings, monthKey, type LedgerAccount, type LedgerAccountType, type LedgerBucket, type LedgerExpense, type LedgerSettings } from "@/lib/ledger/types";

type ExpenseForm = {
  id?: string;
  label: string;
  amount: string;
  bucket: LedgerBucket;
  date: string;
  tags: string;
  notes: string;
};

type AccountForm = {
  id?: string;
  name: string;
  type: LedgerAccountType;
  balance: string;
  institution: string;
  notes: string;
};

type RecentItem = {
  id: string;
  label: string;
  amount: number;
  bucket: LedgerBucket | "income";
  date: string;
  icon: "home" | "income" | "shopping" | "dining" | "utility";
  real?: LedgerExpense;
};

type TagSpend = {
  label: string;
  amount: number;
  color: string;
};

const accountTypes: LedgerAccountType[] = ["checking", "savings", "hysa", "money_market", "cash", "brokerage", "crypto", "retirement", "other"];

const buckets: Array<{ key: LedgerBucket; label: string; color: string; helper: string }> = [
  { key: "needs", label: "Needs", color: "#C9A14A", helper: "Housing, groceries, utilities" },
  { key: "wants", label: "Wants", color: "#EC5C18", helper: "Dining, fun, shopping" },
  { key: "savings", label: "Savings", color: "#3E9E66", helper: "Transfers + investments" },
];

const fallbackRecent: RecentItem[] = [
  { id: "sample-home", label: "Home Insurance", amount: 2400, bucket: "needs", date: "2026-06-21", icon: "home" },
  { id: "sample-income", label: "Salary deposit", amount: -4700, bucket: "income", date: "2026-06-19", icon: "income" },
  { id: "sample-foods", label: "Whole Foods", amount: 96, bucket: "needs", date: "2026-06-20", icon: "shopping" },
  { id: "sample-bartaco", label: "Bartaco", amount: 72, bucket: "wants", date: "2026-06-18", icon: "dining" },
  { id: "sample-electric", label: "Electric Co", amount: 120, bucket: "needs", date: "2026-06-16", icon: "utility" },
];

const fallbackTags: TagSpend[] = [
  { label: "Real Estate", amount: 2400, color: "#E0461A" },
  { label: "Housing", amount: 1850, color: "#F47E16" },
  { label: "Groceries", amount: 540, color: "#C9A14A" },
  { label: "Fun & misc", amount: 500, color: "#EC8B2E" },
  { label: "Dining", amount: 310, color: "#3E9E66" },
  { label: "Utilities", amount: 240, color: "#6FA987" },
  { label: "Transport", amount: 180, color: "#B8A77F" },
  { label: "Subscriptions", amount: 90, color: "#8B7A57" },
];

const tagColors = ["#E0461A", "#F47E16", "#C9A14A", "#EC8B2E", "#3E9E66", "#6FA987", "#B8A77F", "#8B7A57"];

const emptyAccount: AccountForm = {
  name: "",
  type: "checking",
  balance: "",
  institution: "",
  notes: "",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyExpense(date = todayKey()): ExpenseForm {
  return { label: "", amount: "", bucket: "wants", date, tags: "", notes: "" };
}

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value || 0);
}

function formatMonth(value: string, includeYear = false) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: includeYear ? "numeric" : undefined }).format(new Date(year, month - 1, 1));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function addMonths(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

function percent(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
}

function isCurrentMonth(value: string) {
  return value === monthKey(new Date());
}

export function LedgerTool() {
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [settings, setSettings] = useState<LedgerSettings>(defaultLedgerSettings);
  const [viewMonth, setViewMonth] = useState(monthKey(new Date()));
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLedger() {
      setLoading(true);
      const response = await fetch("/api/ledger/data");
      if (response.ok) {
        const data = (await response.json()) as {
          expenses: LedgerExpense[];
          accounts: LedgerAccount[];
          settings: LedgerSettings;
        };
        setExpenses(data.expenses);
        setAccounts(data.accounts);
        setSettings(data.settings);
      }
      setLoading(false);
    }

    void loadLedger();
  }, []);

  const now = new Date();
  const monthExpenses = expenses.filter((expense) => expense.month === viewMonth);
  const hasMonthData = monthExpenses.length > 0;
  const nonSavingsMonthExpenses = monthExpenses.filter((expense) => expense.bucket !== "savings");
  const incomeBase = settings.monthlyBase || 9400;
  const monthlyTarget = computeMonthlyTarget(settings) || 3400;
  const weeklyTarget = computeWeeklyTarget(settings) || 750;
  const weeklySpent = hasMonthData && isCurrentMonth(viewMonth) ? computeWeekSpent(expenses, now) : 640;
  const monthSpent = hasMonthData ? computeMonthSpent(expenses, `${viewMonth}-15`) : 3180;
  const spentByBucket = buckets.reduce<Record<LedgerBucket, number>>((acc, bucket) => {
    acc[bucket.key] = monthExpenses.filter((expense) => expense.bucket === bucket.key).reduce((total, expense) => total + expense.amount, 0);
    return acc;
  }, { needs: 0, wants: 0, savings: 0 });
  const displayBuckets = {
    needs: hasMonthData ? spentByBucket.needs : 4300,
    wants: hasMonthData ? spentByBucket.wants : 1920,
    savings: hasMonthData ? spentByBucket.savings : 3180,
  };
  const displayIncome = hasMonthData ? Math.max(incomeBase, displayBuckets.needs + displayBuckets.wants + displayBuckets.savings) : 9400;
  const monthLeft = Math.max(0, monthlyTarget - monthSpent);
  const weekLeft = Math.max(0, weeklyTarget - weeklySpent);
  const savingsTargetPercent = settings.splitSavings || 20;
  const savingsRate = percent(displayBuckets.savings, displayIncome);
  const savingsDelta = hasMonthData ? Math.round(savingsRate - savingsTargetPercent) : 4;
  const monthDate = new Date(`${viewMonth}-01T00:00:00`);
  const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const dayAnchor = isCurrentMonth(viewMonth) ? now.getDate() : 21;
  const daysLeft = Math.max(0, endOfMonth.getDate() - dayAnchor);
  const netWorth = computeNetWorth(accounts);
  const tagSpend = buildTagSpend(nonSavingsMonthExpenses);
  const visibleTags = tagSpend.length ? tagSpend : fallbackTags;
  const tagTotal = tagSpend.length ? visibleTags.reduce((total, tag) => total + tag.amount, 0) : 6220;
  const recentItems: RecentItem[] = monthExpenses.length
    ? monthExpenses
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((expense) => ({
        id: expense.id,
        label: expense.label,
        amount: expense.amount,
        bucket: expense.bucket,
        date: expense.date,
        icon: iconForExpense(expense),
        real: expense,
      }))
    : fallbackRecent;

  async function saveExpense() {
    if (!expenseForm) return;
    const amount = Number(expenseForm.amount.replaceAll(",", ""));
    if (!expenseForm.label.trim() || Number.isNaN(amount) || amount <= 0) return;
    const payload = {
      label: expenseForm.label.trim(),
      amount,
      bucket: expenseForm.bucket,
      date: expenseForm.date,
      tags: expenseForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: expenseForm.notes,
    };
    const response = await fetch(expenseForm.id ? `/api/ledger/expenses/${expenseForm.id}` : "/api/ledger/expenses", {
      method: expenseForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const { expense } = (await response.json()) as { expense: LedgerExpense };
      setExpenses((current) => expenseForm.id ? current.map((item) => item.id === expense.id ? expense : item) : [expense, ...current]);
      setExpenseForm(null);
    }
  }

  async function deleteExpense(id: string) {
    if (!window.confirm("Delete this ledger entry?")) return;
    const response = await fetch(`/api/ledger/expenses/${id}`, { method: "DELETE" });
    if (response.ok) {
      setExpenses((current) => current.filter((expense) => expense.id !== id));
      setExpenseForm(null);
    }
  }

  async function saveAccount() {
    if (!accountForm) return;
    const payload = {
      name: accountForm.name,
      type: accountForm.type,
      balance: Number(accountForm.balance.replaceAll(",", "")),
      institution: accountForm.institution,
      notes: accountForm.notes,
    };
    const response = await fetch(accountForm.id ? `/api/ledger/accounts/${accountForm.id}` : "/api/ledger/accounts", {
      method: accountForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const { account } = (await response.json()) as { account: LedgerAccount };
      setAccounts((current) => accountForm.id ? current.map((item) => item.id === account.id ? account : item) : [...current, account]);
      setAccountForm(null);
      setAccountsOpen(true);
    }
  }

  async function saveSettings(next: LedgerSettings) {
    const response = await fetch("/api/ledger/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (response.ok) {
      const { settings: saved } = (await response.json()) as { settings: LedgerSettings };
      setSettings(saved);
      setSettingsOpen(false);
    }
  }

  const openNewExpense = () => setExpenseForm(emptyExpense(isCurrentMonth(viewMonth) ? todayKey() : `${viewMonth}-21`));

  return (
    <section className="relative pb-36 md:pb-8">
      <div className="mb-[22px] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-normal text-[var(--foreground)] md:text-[25px]">The Ledger</h1>
          <p className="mt-[3px] text-[12.5px] font-bold text-[var(--muted-soft)] md:text-[13.5px]">
            {formatMonth(viewMonth, true)} · {daysLeft} days left{isCurrentMonth(viewMonth) ? " in the month" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <button className="hidden h-10 items-center gap-2 rounded-[11px] border border-[var(--line)] bg-white px-3 text-[12.5px] font-extrabold text-[#6E6456] hover:bg-[#FBF6EC] md:inline-flex" onClick={() => setAccountsOpen(true)} type="button">
            <WalletCards size={15} />
            Accounts
          </button>
          <button className="hidden h-10 items-center gap-2 rounded-[11px] border border-[var(--line)] bg-white px-3 text-[12.5px] font-extrabold text-[#6E6456] hover:bg-[#FBF6EC] md:inline-flex" onClick={() => setSettingsOpen(true)} type="button">
            <Settings size={15} />
            Settings
          </button>
          <div className="hidden h-10 items-center gap-1 rounded-[11px] border border-[var(--line)] bg-white px-2 text-[13.5px] font-extrabold text-[var(--foreground)] md:flex">
            <button aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8B8173] hover:bg-[#F4ECDD]" onClick={() => setViewMonth(addMonths(viewMonth, -1))} type="button">
              <ChevronLeft size={15} strokeWidth={2.4} />
            </button>
            <span className="hidden min-w-14 text-center md:inline">{formatMonth(viewMonth)}</span>
            <span className="min-w-10 text-center md:hidden">{formatMonth(viewMonth).slice(0, 3)}</span>
            <button aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8B8173] hover:bg-[#F4ECDD]" onClick={() => setViewMonth(addMonths(viewMonth, 1))} type="button">
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          </div>
          <button className="hidden h-11 items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] px-[18px] text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(224,70,26,.26)] transition hover:-translate-y-0.5 md:inline-flex" onClick={openNewExpense} type="button">
            <Plus size={16} strokeWidth={2.3} />
            Add transaction
          </button>
          <button aria-label="Add transaction" className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-white shadow-[0_6px_16px_rgba(224,70,26,.26)] md:hidden" onClick={openNewExpense} type="button">
            <Plus size={19} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {loading ? <div className="mb-4 rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]">Loading ledger...</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        <GaugeCard label="Weekly limit" badge={`${money(weekLeft)} left`} value={weeklySpent} target={weeklyTarget} color="#EC5C18" detail={`${money(weeklySpent)} / ${money(weeklyTarget)}`} />
        <GaugeCard label="Monthly limit" badge={`${money(monthLeft)} left`} value={monthSpent} target={monthlyTarget} color="#E0461A" detail={`${money(monthSpent)} / ${money(monthlyTarget)}`} />
        <GaugeCard className="hidden md:block" label="Savings rate" badge={`${savingsDelta >= 0 ? "+" : ""}${savingsDelta}% vs goal`} value={savingsRate} percentMode color="#3E9E66" detail={`${money(displayBuckets.savings)} saved`} />
      </div>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        <SplitCard buckets={displayBuckets} income={displayIncome} settings={settings} />
        <RecentCard items={recentItems} onEdit={(expense) => setExpenseForm({ id: expense.id, label: expense.label, amount: String(expense.amount), bucket: expense.bucket, date: expense.date, tags: expense.tags.join(", "), notes: expense.notes })} />
      </div>

      <div className="mt-4 lg:mt-5">
        <TagCard tags={visibleTags} total={tagTotal} />
      </div>

      <div className="mt-4 grid gap-4 lg:hidden">
        <button className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-[var(--line)] bg-white text-sm font-extrabold text-[#6E6456]" onClick={() => setAccountsOpen(true)} type="button">
          <WalletCards size={16} />
          Accounts
        </button>
        <button className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-[var(--line)] bg-white text-sm font-extrabold text-[#6E6456]" onClick={() => setSettingsOpen(true)} type="button">
          <Settings size={16} />
          Settings
        </button>
      </div>

      <button aria-label="Add expense" className="fixed bottom-[104px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-white shadow-[0_10px_24px_rgba(224,70,26,.4)] transition hover:-translate-y-0.5 md:bottom-[30px] md:right-[34px] md:w-auto md:px-[22px]" onClick={openNewExpense} type="button">
        <Plus size={24} strokeWidth={2.4} />
        <span className="hidden text-[14.5px] font-extrabold md:inline">Add expense</span>
      </button>

      {expenseForm ? <ExpenseModal form={expenseForm} onClose={() => setExpenseForm(null)} onDelete={expenseForm.id ? () => void deleteExpense(expenseForm.id!) : undefined} onSave={() => void saveExpense()} setForm={setExpenseForm} /> : null}
      {accountForm ? <AccountModal form={accountForm} onClose={() => setAccountForm(null)} onSave={() => void saveAccount()} setForm={setAccountForm} /> : null}
      {accountsOpen ? <AccountsModal accounts={accounts} netWorth={netWorth} onAdd={() => setAccountForm(emptyAccount)} onClose={() => setAccountsOpen(false)} onEdit={(account) => setAccountForm({ id: account.id, name: account.name, type: account.type, balance: String(account.balance), institution: account.institution, notes: account.notes })} /> : null}
      {settingsOpen ? <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)} onSave={(next) => void saveSettings(next)} /> : null}
    </section>
  );
}

function GaugeCard({ label, badge, value, target, color, detail, percentMode = false, className = "" }: { label: string; badge: string; value: number; target?: number; color: string; detail: string; percentMode?: boolean; className?: string }) {
  const progress = percentMode ? Math.min(100, value) : percent(value, target || 1);
  const displayProgress = percentMode ? Math.round(progress) : Math.floor(progress);
  const positiveBadge = color === "#3E9E66" || label.includes("Weekly");
  return (
    <div className={`rounded-[18px] border border-[var(--line)] bg-white p-[15px] shadow-[0_6px_16px_rgba(90,55,20,.04)] md:rounded-[22px] md:p-[22px] md:shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)] ${className}`}>
      <div className="mb-[11px] flex items-center justify-center md:mb-[18px] md:justify-between">
        <span className="text-xs font-extrabold text-[var(--foreground)] md:text-[15px]">
          <span className="md:hidden">{label.replace(" limit", "")}</span>
          <span className="hidden md:inline">{label}</span>
        </span>
        <span className={`hidden rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold md:inline ${positiveBadge ? "bg-[#E6F0E5] text-[#256B43]" : "bg-[#FCEBDD] text-[#C24A12]"}`}>{badge}</span>
      </div>
      <div className="mx-auto flex h-[88px] w-[88px] items-center justify-center rounded-full md:h-[148px] md:w-[148px]" style={{ background: `conic-gradient(${color} 0% ${progress}%, #EDE3D0 ${progress}% 100%)` }}>
        <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-white md:h-28 md:w-28">
          <span className={`text-[19px] font-extrabold leading-none md:text-[30px] ${color === "#3E9E66" ? "text-[#2E7D52]" : "text-[var(--foreground)]"}`}>{displayProgress}%</span>
          <span className="mt-[3px] hidden text-[11px] font-bold text-[var(--muted-soft)] md:block">{percentMode ? "saved" : "used"}</span>
        </div>
      </div>
      <div className="mt-2.5 text-center font-mono text-[11px] font-medium text-[#8B8173] md:mt-4 md:text-[13.5px]">
        {detail}
      </div>
    </div>
  );
}

function SplitCard({ buckets: displayBuckets, income, settings }: { buckets: Record<LedgerBucket, number>; income: number; settings: LedgerSettings }) {
  const maxTargets = {
    needs: computeBucketTarget(settings, "needs") || 4700,
    wants: computeBucketTarget(settings, "wants") || 2820,
    savings: computeBucketTarget(settings, "savings") || income * 0.2,
  };

  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[0_6px_16px_rgba(90,55,20,.04)] md:rounded-[22px] md:p-6">
      <div className="mb-[13px] flex items-baseline justify-between md:mb-[18px]">
        <h2 className="text-[14.5px] font-extrabold text-[var(--foreground)] md:text-base">Needs · Wants · Savings</h2>
        <span className="hidden text-[12.5px] font-bold text-[var(--muted-soft)] md:block">of {money(income)} income</span>
      </div>
      <div className="mb-[15px] flex h-3 overflow-hidden rounded-md md:mb-5 md:h-3.5 md:rounded-lg">
        {buckets.map((bucket) => (
          <div key={bucket.key} style={{ background: bucket.color, width: `${percent(displayBuckets[bucket.key], income)}%` }} />
        ))}
      </div>
      <div className="grid gap-0.5">
        {buckets.map((bucket) => {
          const spent = displayBuckets[bucket.key];
          const bucketPercent = percent(spent, income);
          const remaining = Math.max(0, maxTargets[bucket.key] - spent);
          return (
            <div className="flex items-center gap-2.5 rounded-[12px] px-0.5 py-[7px] hover:bg-[#FBF6EC] md:gap-[13px] md:px-2 md:py-[11px]" key={bucket.key}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] md:h-[11px] md:w-[11px] md:rounded" style={{ background: bucket.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[var(--foreground)] md:text-sm">{bucket.label}</p>
                <p className="hidden text-[11.5px] font-semibold text-[var(--muted-soft)] md:block">{bucket.helper}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-[12.5px] font-medium md:text-sm ${bucket.key === "savings" ? "text-[#2E7D52]" : "text-[var(--foreground)]"}`}>{money(spent)}</p>
                <p className="text-[11px] font-bold text-[#256B43]">{Math.round(bucketPercent)}%{bucket.key === "savings" ? ` · target ${settings.splitSavings || 20}%` : ` · ${money(remaining)} left`}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentCard({ items, onEdit }: { items: RecentItem[]; onEdit: (expense: LedgerExpense) => void }) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[0_6px_16px_rgba(90,55,20,.04)] md:rounded-[22px] md:p-[22px]">
      <div className="mb-2.5 flex items-center justify-between md:mb-3">
        <h2 className="text-[14.5px] font-extrabold text-[var(--foreground)] md:text-base">Recent</h2>
        <span className="hidden text-xs font-bold text-[#C24A12] md:block">All transactions</span>
      </div>
      <div className="grid">
        {items.map((item) => (
          <button className="flex items-center gap-3 rounded-[11px] px-1 py-[9px] text-left hover:bg-[#FBF6EC] md:px-2 md:py-2.5" disabled={!item.real} key={item.id} onClick={() => item.real ? onEdit(item.real) : undefined} type="button">
            <RecentIcon icon={item.icon} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-[var(--foreground)] md:text-[13.5px]">{item.label}</span>
              <span className="block text-[11px] font-semibold capitalize text-[var(--muted-soft)] md:text-[11.5px]">{formatDate(item.date)} · {item.bucket}</span>
            </span>
            <span className={`font-mono text-[13px] font-medium md:text-[13.5px] ${item.bucket === "income" ? "text-[#2E7D52]" : "text-[#42392E]"}`}>
              {item.bucket === "income" ? "+" : "-"}{money(Math.abs(item.amount))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TagCard({ tags, total }: { tags: TagSpend[]; total: number }) {
  const gradient = buildConicGradient(tags, total);
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[0_6px_16px_rgba(90,55,20,.04)] md:rounded-[22px] md:p-6">
      <div className="mb-3.5 flex items-center justify-between md:mb-[18px]">
        <h2 className="text-[14.5px] font-extrabold text-[var(--foreground)] md:text-base">Spending by tag</h2>
        <span className="text-[11.5px] font-bold text-[var(--muted-soft)] md:text-[12.5px]">{money(total)} this month</span>
      </div>
      <div className="flex items-center gap-4 md:gap-9">
        <div className="flex h-[122px] w-[122px] shrink-0 items-center justify-center rounded-full md:h-[184px] md:w-[184px]" style={{ background: gradient }}>
          <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-white md:h-[116px] md:w-[116px]">
            <span className="font-mono text-[15px] font-medium text-[var(--foreground)] md:text-[21px]">{money(total, true)}</span>
            <span className="text-[9px] font-bold text-[var(--muted-soft)] md:text-[11px]">spent</span>
          </div>
        </div>
        <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2 md:gap-x-7 md:gap-y-[13px]">
          {tags.slice(0, 8).map((tag) => (
            <div className="flex min-w-0 items-center gap-2" key={tag.label}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tag.color }} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[#42392E] md:text-[13.5px]">{tag.label}</span>
              <span className="font-mono text-[10.5px] text-[#8B8173] md:text-[12.5px]">{money(tag.amount)}</span>
            </div>
          ))}
          {tags.length > 5 ? <div className="pl-[18px] text-[11px] font-bold text-[var(--muted-soft)] md:hidden">+{tags.length - 5} more</div> : null}
        </div>
      </div>
    </div>
  );
}

function RecentIcon({ icon }: { icon: RecentItem["icon"] }) {
  const iconMap: Record<RecentItem["icon"], { Icon?: LucideIcon; label?: string; className: string }> = {
    home: { Icon: Home, className: "bg-[#FCEBDD] text-[#E0461A]" },
    income: { label: "$", className: "bg-[#E6F0E5] text-[#2E7D52]" },
    shopping: { Icon: ShoppingBag, className: "bg-[#F1E8D8] text-[#8B7A57]" },
    dining: { Icon: Utensils, className: "bg-[#F1E8D8] text-[#8B7A57]" },
    utility: { Icon: Zap, className: "bg-[#F1E8D8] text-[#8B7A57]" },
  };
  const config = iconMap[icon];
  const Icon = config.Icon;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] md:h-[34px] md:w-[34px] ${config.className}`}>
      {Icon ? <Icon size={16} strokeWidth={2} /> : <span className="text-[15px] font-extrabold">{config.label}</span>}
    </span>
  );
}

function ExpenseModal({ form, setForm, onClose, onSave, onDelete }: { form: ExpenseForm; setForm: (form: ExpenseForm | null) => void; onClose: () => void; onSave: () => void; onDelete?: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(34,22,12,.5)] p-0 md:items-center md:p-6">
      <div className="w-full max-w-[420px] rounded-t-[28px] bg-[#FBF5EA] shadow-[0_-14px_44px_rgba(40,25,10,.32)] md:rounded-[22px] md:shadow-[0_30px_70px_rgba(40,25,10,.22)]">
        <div className="mx-auto mt-2 h-[5px] w-[38px] rounded-full bg-[#E1D6BF] md:hidden" />
        <div className="flex items-center gap-3 px-5 pb-4 pt-5 md:px-[22px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#FCEBDD] text-[#E0461A]"><Plus size={18} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-extrabold text-[var(--foreground)]">{form.id ? "Edit expense" : "Add expense"}</h3>
            <p className="text-xs font-semibold text-[var(--muted-soft)]">New transaction · {formatMonth(monthKey(form.date))}</p>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#F1E8D8] text-[#8B7A57]" onClick={onClose} type="button" aria-label="Close">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="grid gap-3.5 px-5 pb-4 md:px-[22px]">
          <label className="flex items-center justify-center gap-1 rounded-[14px] border border-[#E7DBC4] bg-white p-3.5 md:p-4">
            <span className="text-[22px] font-extrabold text-[#8B7A57] md:text-[26px]">$</span>
            <input className="w-40 border-0 bg-transparent text-center text-[26px] font-extrabold text-[var(--foreground)] outline-none md:text-[30px]" inputMode="decimal" onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" value={form.amount} />
          </label>
          <Field label="Category" value={form.label} onChange={(label) => setForm({ ...form, label })} placeholder="Dining" />
          <div>
            <FieldLabel>Bucket</FieldLabel>
            <div className="flex gap-2">
              {buckets.map((bucket) => (
                <button className={`flex-1 rounded-[10px] px-2 py-2.5 text-[12.5px] font-extrabold md:text-[13px] ${form.bucket === bucket.key ? "bg-[#EC5C18] text-white" : "bg-[#F1E8D8] text-[#8B8173]"}`} key={bucket.key} onClick={() => setForm({ ...form, bucket: bucket.key })} type="button">
                  {bucket.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Tags</FieldLabel>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["Dining", "Date night", "Recurring"].map((tag) => (
                <button className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${form.tags.toLowerCase().includes(tag.toLowerCase()) ? "bg-[#FCEBDD] text-[#C24A12]" : "bg-[#F1E8D8] text-[#8B8173]"}`} key={tag} onClick={() => toggleTag(form, tag, setForm)} type="button">
                  {tag}
                </button>
              ))}
              <span className="rounded-full border border-dashed border-[#D8CDB6] bg-white px-3 py-1.5 text-xs font-bold text-[#A99B82]">+ New tag</span>
            </div>
            <input className="h-10 w-full rounded-[11px] border border-[#E7DBC4] bg-white px-3 text-sm font-semibold text-[var(--foreground)] outline-none" onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Comma separated tags" value={form.tags} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date" value={form.date} onChange={(date) => setForm({ ...form, date })} type="date" />
            <Field label="Note" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-[#EFE6D5] bg-[#FDFAF3] px-5 py-4 md:px-[22px]">
          {onDelete ? <button className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#E7DBC4] bg-white text-[#C24A12]" onClick={onDelete} type="button" aria-label="Delete expense"><Trash2 size={17} /></button> : null}
          <button className="h-12 flex-1 rounded-[12px] border-[1.5px] border-[#E7DBC4] bg-white text-sm font-bold text-[#6E6456]" onClick={onClose} type="button">Cancel</button>
          <button className="h-12 flex-[1.5] rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-sm font-bold text-white shadow-[0_6px_16px_rgba(224,70,26,.26)]" onClick={onSave} type="button">{form.id ? "Save expense" : "Add expense"}</button>
        </div>
      </div>
    </div>
  );
}

function AccountsModal({ accounts, netWorth, onAdd, onClose, onEdit }: { accounts: LedgerAccount[]; netWorth: ReturnType<typeof computeNetWorth>; onAdd: () => void; onClose: () => void; onEdit: (account: LedgerAccount) => void }) {
  return (
    <Modal title="Accounts" icon={WalletCards} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Cash" value={money(netWorth.cash)} />
        <MiniStat label="Invested" value={money(netWorth.investments)} />
        <MiniStat label="Total" value={money(netWorth.total)} />
      </div>
      <div className="grid gap-2">
        {accounts.length ? accounts.map((account) => (
          <button className="flex items-center justify-between gap-3 rounded-[13px] border border-[#E7DBC4] bg-white p-3 text-left hover:bg-[#FBF6EC]" key={account.id} onClick={() => onEdit(account)} type="button">
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-[var(--foreground)]">{account.name}</span>
              <span className="block text-xs font-semibold capitalize text-[var(--muted-soft)]">{account.type.replaceAll("_", " ")}{account.institution ? ` · ${account.institution}` : ""}</span>
            </span>
            <span className="font-mono text-sm font-medium text-[var(--foreground)]">{money(account.balance)}</span>
          </button>
        )) : <p className="rounded-[13px] border border-dashed border-[#D8CDB6] bg-white p-4 text-sm font-semibold text-[var(--muted)]">No accounts yet.</p>}
      </div>
      <button className="h-12 rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-sm font-bold text-white shadow-[0_6px_16px_rgba(224,70,26,.26)]" onClick={onAdd} type="button">Add account</button>
    </Modal>
  );
}

function AccountModal({ form, setForm, onClose, onSave }: { form: AccountForm; setForm: (form: AccountForm | null) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title={form.id ? "Edit account" : "Add account"} icon={WalletCards} onClose={onClose}>
      <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <label className="grid gap-1">
        <FieldLabel>Type</FieldLabel>
        <select className="h-11 rounded-[11px] border border-[#E7DBC4] bg-white px-3 text-sm font-semibold capitalize text-[var(--foreground)] outline-none" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LedgerAccountType })}>
          {accountTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <Field label="Balance" value={form.balance} onChange={(balance) => setForm({ ...form, balance })} inputMode="decimal" />
      <Field label="Institution" value={form.institution} onChange={(institution) => setForm({ ...form, institution })} />
      <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
      <button className="h-12 rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-sm font-bold text-white shadow-[0_6px_16px_rgba(224,70,26,.26)]" onClick={onSave} type="button">{form.id ? "Save account" : "Add account"}</button>
    </Modal>
  );
}

function SettingsModal({ settings, onClose, onSave }: { settings: LedgerSettings; onClose: () => void; onSave: (settings: LedgerSettings) => void }) {
  const [form, setForm] = useState(settings);
  return (
    <Modal title="Ledger settings" icon={Settings} onClose={onClose}>
      <Field label="Monthly base income" value={String(form.monthlyBase)} onChange={(value) => setForm({ ...form, monthlyBase: Number(value) })} inputMode="decimal" />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Needs %" value={String(form.splitNeeds)} onChange={(value) => setForm({ ...form, splitNeeds: Number(value) })} inputMode="numeric" />
        <Field label="Wants %" value={String(form.splitWants)} onChange={(value) => setForm({ ...form, splitWants: Number(value) })} inputMode="numeric" />
        <Field label="Savings %" value={String(form.splitSavings)} onChange={(value) => setForm({ ...form, splitSavings: Number(value) })} inputMode="numeric" />
      </div>
      <button className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-gradient-to-br from-[#F47E16] to-[#E84B1B] text-sm font-bold text-white shadow-[0_6px_16px_rgba(224,70,26,.26)]" onClick={() => onSave(form)} type="button">
        <Save size={17} />
        Save settings
      </button>
    </Modal>
  );
}

function Modal({ title, icon: Icon, children, onClose }: { title: string; icon: LucideIcon; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(34,22,12,.5)] p-0 md:items-center md:p-6">
      <div className="w-full max-w-[460px] rounded-t-[28px] bg-[#FBF5EA] shadow-[0_-14px_44px_rgba(40,25,10,.32)] md:rounded-[22px] md:shadow-[0_30px_70px_rgba(40,25,10,.22)]">
        <div className="mx-auto mt-2 h-[5px] w-[38px] rounded-full bg-[#E1D6BF] md:hidden" />
        <div className="flex items-center gap-3 px-5 pb-4 pt-5 md:px-[22px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#FCEBDD] text-[#E0461A]"><Icon size={18} /></span>
          <h3 className="min-w-0 flex-1 text-[17px] font-extrabold text-[var(--foreground)]">{title}</h3>
          <button className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#F1E8D8] text-[#8B7A57]" onClick={onClose} type="button" aria-label="Close">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto px-5 pb-5 md:px-[22px]">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", inputMode, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; placeholder?: string }) {
  return (
    <label className="grid gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input className="h-11 rounded-[11px] border border-[#E7DBC4] bg-white px-3 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[#A99B82]" inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--muted-soft)] md:text-[11px]">{children}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[13px] border border-[#E7DBC4] bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--muted-soft)]">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function buildTagSpend(expenses: LedgerExpense[]) {
  const map = new Map<string, number>();
  expenses.forEach((expense) => {
    const label = expense.tags[0] || expense.bucket[0].toUpperCase() + expense.bucket.slice(1);
    map.set(label, (map.get(label) || 0) + expense.amount);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, amount], index) => ({ label, amount, color: tagColors[index % tagColors.length] }));
}

function buildConicGradient(tags: TagSpend[], total: number) {
  if (!tags.length || total <= 0) return "conic-gradient(#EDE3D0 0 100%)";
  let start = 0;
  const stops = tags.map((tag) => {
    const end = start + (tag.amount / total) * 100;
    const segment = `${tag.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function iconForExpense(expense: LedgerExpense): RecentItem["icon"] {
  const text = `${expense.label} ${expense.tags.join(" ")}`.toLowerCase();
  if (text.includes("home") || text.includes("rent") || text.includes("mortgage") || text.includes("real estate")) return "home";
  if (text.includes("food") || text.includes("grocery") || text.includes("market")) return "shopping";
  if (text.includes("dining") || text.includes("restaurant") || text.includes("taco") || text.includes("coffee")) return "dining";
  if (text.includes("electric") || text.includes("utility") || text.includes("gas") || text.includes("water")) return "utility";
  return expense.bucket === "needs" ? "home" : "dining";
}

function toggleTag(form: ExpenseForm, tag: string, setForm: (form: ExpenseForm | null) => void) {
  const current = form.tags.split(",").map((item) => item.trim()).filter(Boolean);
  const exists = current.some((item) => item.toLowerCase() === tag.toLowerCase());
  const next = exists ? current.filter((item) => item.toLowerCase() !== tag.toLowerCase()) : [...current, tag];
  setForm({ ...form, tags: next.join(", ") });
}
