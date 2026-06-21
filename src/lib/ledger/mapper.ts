import { accountCategory, defaultLedgerSettings, type LedgerAccount, type LedgerAccountType, type LedgerExpense, type LedgerSettings } from "@/lib/ledger/types";

type ExpenseRow = {
  id: string;
  label: string;
  amount: number;
  bucket: string;
  expense_date: string;
  month: string;
  tags: string[];
  notes: string | null;
};

type AccountRow = {
  id: string;
  name: string;
  account_type: string;
  balance: number;
  category: string;
  institution: string | null;
  notes: string | null;
  last_updated_at: string;
};

type SettingsRow = {
  monthly_base: number;
  split_needs: number;
  split_wants: number;
  split_savings: number;
} | null;

export function dbExpense(row: ExpenseRow): LedgerExpense {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount ?? 0),
    bucket: row.bucket as LedgerExpense["bucket"],
    date: row.expense_date,
    month: row.month,
    tags: row.tags ?? [],
    notes: row.notes ?? "",
  };
}

export function dbAccount(row: AccountRow): LedgerAccount {
  const type = row.account_type as LedgerAccountType;
  return {
    id: row.id,
    name: row.name,
    type,
    category: row.category === "investment" ? "investment" : accountCategory(type),
    balance: Number(row.balance ?? 0),
    institution: row.institution ?? "",
    notes: row.notes ?? "",
    lastUpdatedAt: row.last_updated_at,
  };
}

export function dbSettings(row: SettingsRow): LedgerSettings {
  if (!row) {
    return defaultLedgerSettings;
  }

  return {
    monthlyBase: Number(row.monthly_base ?? 0),
    splitNeeds: row.split_needs ?? defaultLedgerSettings.splitNeeds,
    splitWants: row.split_wants ?? defaultLedgerSettings.splitWants,
    splitSavings: row.split_savings ?? defaultLedgerSettings.splitSavings,
  };
}
