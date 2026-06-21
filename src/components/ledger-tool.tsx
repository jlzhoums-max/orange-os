"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Leaf, Plus, Save, Settings, Trash2, WalletCards, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  computeBucketTarget,
  computeMonthSpent,
  computeMonthlySavingsStreak,
  computeMonthlyTarget,
  computeNetWorth,
  computeTodaySpent,
  computeWeekSpent,
  computeWeeklyTarget,
  computeYearEndProjection,
} from "@/lib/ledger/calc";
import { defaultLedgerSettings, monthKey, type LedgerAccount, type LedgerAccountType, type LedgerBucket, type LedgerExpense, type LedgerSettings } from "@/lib/ledger/types";

type LedgerTab = "overview" | "budget" | "accounts";
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

const buckets: Array<{ key: LedgerBucket; label: string }> = [
  { key: "needs", label: "Needs" },
  { key: "wants", label: "Wants" },
  { key: "savings", label: "Savings" },
];

const accountTypes: LedgerAccountType[] = ["checking", "savings", "hysa", "money_market", "cash", "brokerage", "crypto", "retirement", "other"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function emptyExpense(date = todayKey()): ExpenseForm {
  return { label: "", amount: "", bucket: "needs", date, tags: "", notes: "" };
}

const emptyAccount: AccountForm = {
  name: "",
  type: "checking",
  balance: "",
  institution: "",
  notes: "",
};

export function LedgerTool() {
  const [tab, setTab] = useState<LedgerTab>("overview");
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [settings, setSettings] = useState<LedgerSettings>(defaultLedgerSettings);
  const [viewMonth, setViewMonth] = useState(monthKey(new Date()));
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
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
  const monthlyTarget = computeMonthlyTarget(settings);
  const monthSpent = computeMonthSpent(expenses, `${viewMonth}-15`);
  const currentSpent = computeMonthSpent(expenses, now);
  const weeklySpent = computeWeekSpent(expenses, now);
  const weeklyTarget = computeWeeklyTarget(settings);
  const todaySpent = computeTodaySpent(expenses, now);
  const netWorth = computeNetWorth(accounts);
  const savingsStreak = computeMonthlySavingsStreak(expenses, now);
  const savingsProjection = computeYearEndProjection(expenses, now);
  const daysLeft = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const monthRemaining = Math.max(0, monthlyTarget - currentSpent);

  async function saveExpense() {
    if (!expenseForm) return;
    const payload = {
      label: expenseForm.label,
      amount: Number(expenseForm.amount.replaceAll(",", "")),
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

  return (
    <section className="relative grid gap-5">
      <div className="flex flex-col gap-3 rounded-[1.5rem] border-2 border-[var(--line)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["overview", "budget", "accounts"] as LedgerTab[]).map((item) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-[var(--secondary-container)] text-[var(--secondary)]" : "text-[var(--muted)] hover:bg-[var(--panel-strong)]"}`}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)]" onClick={() => setSettingsOpen(true)} type="button">
          <Settings size={16} />
          Settings
        </button>
      </div>

      {loading ? <div className="os-card p-6 text-sm text-[var(--muted)]">Loading ledger...</div> : null}

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="os-card border-2 p-7">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Monthly Remaining</p>
            <p className="mt-4 font-serif text-5xl italic tracking-normal text-[var(--accent)]">{money(monthRemaining)}</p>
            <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">
              Needs and wants only. Savings is treated as the commitment, not the spending constraint.
            </p>
            <div className="mt-6 h-1.5 rounded-full bg-[var(--panel-deep)]">
              <div className="h-full rounded-full bg-[var(--primary-container)]" style={{ width: `${Math.min(100, (currentSpent / Math.max(monthlyTarget, 1)) * 100)}%` }} />
            </div>
          </div>
          <div className="grid gap-4">
            <MetricCard icon={CalendarDays} label="Current week" value={`${money(weeklySpent)} / ${money(weeklyTarget)}`} detail={`Today: ${money(todaySpent)}`} />
            <MetricCard icon={WalletCards} label="Net worth" value={money(netWorth.total)} detail={`Cash ${money(netWorth.cash)} · Investments ${money(netWorth.investments)}`} />
            <MetricCard icon={Leaf} label="Savings streak" value={`${savingsStreak}-month streak`} detail={`Year-end projection ${money(savingsProjection)}`} />
          </div>
        </div>
      ) : null}

      {tab === "budget" ? (
        <div className="grid gap-4">
          <div className="os-card border-2 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Month at a glance</p>
                <h2 className="mt-2 text-3xl font-bold">{viewMonth}</h2>
              </div>
              <input className="os-input h-11 px-4 text-sm" onChange={(event) => setViewMonth(event.target.value)} type="month" value={viewMonth} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Stat label="Spent" value={money(monthSpent)} />
              <Stat label="Remaining" value={money(Math.max(0, monthlyTarget - monthSpent))} />
              <Stat label="Days left" value={String(daysLeft)} />
              <Stat label="Pace" value={monthSpent > monthlyTarget ? "Over" : "On track"} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {buckets.map((bucket) => {
              const spent = monthExpenses.filter((expense) => expense.bucket === bucket.key).reduce((total, expense) => total + expense.amount, 0);
              const target = computeBucketTarget(settings, bucket.key);
              return <BucketCard key={bucket.key} label={bucket.label} spent={spent} target={target} />;
            })}
          </div>

          <ExpenseList expenses={monthExpenses} onDelete={deleteExpense} onEdit={(expense) => setExpenseForm({ id: expense.id, label: expense.label, amount: String(expense.amount), bucket: expense.bucket, date: expense.date, tags: expense.tags.join(", "), notes: expense.notes })} />
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AccountGroup title="Cash" accounts={accounts.filter((account) => account.category === "cash")} onEdit={(account) => setAccountForm({ id: account.id, name: account.name, type: account.type, balance: String(account.balance), institution: account.institution, notes: account.notes })} />
          <AccountGroup title="Investments" accounts={accounts.filter((account) => account.category === "investment")} onEdit={(account) => setAccountForm({ id: account.id, name: account.name, type: account.type, balance: String(account.balance), institution: account.institution, notes: account.notes })} />
          <button className="os-primary-button fixed bottom-24 right-5 z-40 flex h-14 items-center gap-2 px-5 text-sm font-semibold" onClick={() => setAccountForm(emptyAccount)} type="button">
            <Plus size={18} />
            Add Account
          </button>
        </div>
      ) : null}

      <button className="os-primary-button fixed bottom-24 right-5 z-40 flex h-14 items-center gap-2 px-5 text-sm font-semibold" onClick={() => setExpenseForm(emptyExpense(viewMonth === monthKey(new Date()) ? todayKey() : `${viewMonth}-28`))} type="button">
        <Plus size={18} />
        Add Entry
      </button>

      {expenseForm ? <ExpenseModal form={expenseForm} setForm={setExpenseForm} onClose={() => setExpenseForm(null)} onSave={saveExpense} /> : null}
      {accountForm ? <AccountModal form={accountForm} setForm={setAccountForm} onClose={() => setAccountForm(null)} onSave={saveAccount} /> : null}
      {settingsOpen ? <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} /> : null}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="os-card-soft border-2 p-5">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Icon size={16} />
        {label}
      </div>
      <p className="mt-3 font-serif text-3xl italic text-[var(--accent)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--line)] p-4">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-serif text-2xl italic">{value}</p>
    </div>
  );
}

function BucketCard({ label, spent, target }: { label: string; spent: number; target: number }) {
  const percent = Math.min(100, (spent / Math.max(target, 1)) * 100);
  return (
    <div className="os-card p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 font-serif text-3xl italic">{money(spent)}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">Target {money(target)}</p>
      <div className="mt-4 h-1 rounded-full bg-[var(--panel-deep)]">
        <div className="h-full rounded-full bg-[var(--primary-container)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ExpenseList({ expenses, onEdit, onDelete }: { expenses: LedgerExpense[]; onEdit: (expense: LedgerExpense) => void; onDelete: (id: string) => void }) {
  return (
    <div className="os-card p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Entries</p>
      <div className="mt-4 space-y-2">
        {expenses.length ? expenses.map((expense) => (
          <button className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left hover:bg-[var(--panel-strong)]" key={expense.id} onClick={() => onEdit(expense)} type="button">
            <span>
              <span className="block font-semibold">{expense.label}</span>
              <span className="text-sm capitalize text-[var(--muted)]">{expense.bucket} · {expense.date}</span>
            </span>
            <span className="font-mono">{money(expense.amount)}</span>
            <span onClick={(event) => { event.stopPropagation(); void onDelete(expense.id); }} role="button" tabIndex={0}>
              <Trash2 size={17} />
            </span>
          </button>
        )) : <p className="text-sm text-[var(--muted)]">No entries for this month yet.</p>}
      </div>
    </div>
  );
}

function AccountGroup({ title, accounts, onEdit }: { title: string; accounts: LedgerAccount[]; onEdit: (account: LedgerAccount) => void }) {
  return (
    <div className="os-card p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
      <div className="mt-4 space-y-2">
        {accounts.length ? accounts.map((account) => (
          <button className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3 text-left hover:bg-[var(--panel-strong)]" key={account.id} onClick={() => onEdit(account)} type="button">
            <span>
              <span className="block font-semibold">{account.name}</span>
              <span className="text-sm capitalize text-[var(--muted)]">{account.type.replaceAll("_", " ")}{account.institution ? ` · ${account.institution}` : ""}</span>
            </span>
            <span className="font-serif text-2xl italic">{money(account.balance)}</span>
          </button>
        )) : <p className="text-sm text-[var(--muted)]">No accounts yet.</p>}
      </div>
    </div>
  );
}

function ExpenseModal({ form, setForm, onClose, onSave }: { form: ExpenseForm; setForm: (form: ExpenseForm | null) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title={form.id ? "Edit Entry" : "Add Entry"} onClose={onClose}>
      <Field label="Description" value={form.label} onChange={(label) => setForm({ ...form, label })} />
      <Field label="Amount" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} inputMode="decimal" />
      <label className="grid gap-1 text-sm font-medium">
        <span>Bucket</span>
        <select className="os-input h-11 px-4" value={form.bucket} onChange={(event) => setForm({ ...form, bucket: event.target.value as LedgerBucket })}>
          {buckets.map((bucket) => <option key={bucket.key} value={bucket.key}>{bucket.label}</option>)}
        </select>
      </label>
      <Field label="Date" value={form.date} onChange={(date) => setForm({ ...form, date })} type="date" />
      <Field label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
      <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
      <button className="os-primary-button mt-2 h-12 px-5 font-semibold" onClick={onSave} type="button">{form.id ? "Save" : "Add Entry"}</button>
    </Modal>
  );
}

function AccountModal({ form, setForm, onClose, onSave }: { form: AccountForm; setForm: (form: AccountForm | null) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title={form.id ? "Edit Account" : "Add Account"} onClose={onClose}>
      <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <label className="grid gap-1 text-sm font-medium">
        <span>Type</span>
        <select className="os-input h-11 px-4" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LedgerAccountType })}>
          {accountTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <Field label="Balance" value={form.balance} onChange={(balance) => setForm({ ...form, balance })} inputMode="decimal" />
      <Field label="Institution" value={form.institution} onChange={(institution) => setForm({ ...form, institution })} />
      <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
      <button className="os-primary-button mt-2 h-12 px-5 font-semibold" onClick={onSave} type="button">{form.id ? "Save" : "Add Account"}</button>
    </Modal>
  );
}

function SettingsModal({ settings, onClose, onSave }: { settings: LedgerSettings; onClose: () => void; onSave: (settings: LedgerSettings) => void }) {
  const [form, setForm] = useState(settings);
  return (
    <Modal title="Ledger Settings" onClose={onClose}>
      <Field label="Monthly base income" value={String(form.monthlyBase)} onChange={(value) => setForm({ ...form, monthlyBase: Number(value) })} inputMode="decimal" />
      <Field label="Needs %" value={String(form.splitNeeds)} onChange={(value) => setForm({ ...form, splitNeeds: Number(value) })} inputMode="numeric" />
      <Field label="Wants %" value={String(form.splitWants)} onChange={(value) => setForm({ ...form, splitWants: Number(value) })} inputMode="numeric" />
      <Field label="Savings %" value={String(form.splitSavings)} onChange={(value) => setForm({ ...form, splitSavings: Number(value) })} inputMode="numeric" />
      <button className="os-primary-button mt-2 inline-flex h-12 items-center justify-center gap-2 px-5 font-semibold" onClick={() => onSave(form)} type="button">
        <Save size={17} />
        Save settings
      </button>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#1a1d13]/35 p-3 backdrop-blur-md sm:items-center">
      <div className="os-card w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold">{title}</h3>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--panel-strong)]" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input className="os-input h-11 px-4" inputMode={inputMode} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}
