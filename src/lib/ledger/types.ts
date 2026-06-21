export type LedgerBucket = "needs" | "wants" | "savings";

export type LedgerAccountType =
  | "checking"
  | "savings"
  | "hysa"
  | "money_market"
  | "cash"
  | "brokerage"
  | "crypto"
  | "retirement"
  | "other";

export type LedgerAccountCategory = "cash" | "investment";

export type LedgerExpense = {
  id: string;
  label: string;
  amount: number;
  bucket: LedgerBucket;
  date: string;
  month: string;
  tags: string[];
  notes: string;
};

export type LedgerAccount = {
  id: string;
  name: string;
  type: LedgerAccountType;
  category: LedgerAccountCategory;
  balance: number;
  institution: string;
  notes: string;
  lastUpdatedAt: string;
};

export type LedgerSettings = {
  monthlyBase: number;
  splitNeeds: number;
  splitWants: number;
  splitSavings: number;
};

export const defaultLedgerSettings: LedgerSettings = {
  monthlyBase: 0,
  splitNeeds: 40,
  splitWants: 40,
  splitSavings: 20,
};

export function accountCategory(type: LedgerAccountType): LedgerAccountCategory {
  return type === "brokerage" || type === "crypto" || type === "retirement" ? "investment" : "cash";
}

export function monthKey(date: Date | string) {
  return (typeof date === "string" ? date : date.toISOString()).slice(0, 7);
}
