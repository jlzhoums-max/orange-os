import type { LedgerAccount, LedgerBucket, LedgerExpense, LedgerSettings } from "@/lib/ledger/types";

const nonSavingsBuckets: LedgerBucket[] = ["needs", "wants"];

function toDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthKey(date: string | Date) {
  return toDay(date).toISOString().slice(0, 7);
}

function sameDay(a: string | Date, b: string | Date) {
  return toDay(a).getTime() === toDay(b).getTime();
}

function weekStart(date: string | Date) {
  const day = toDay(date);
  const weekday = day.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + diff);
  return day;
}

function inCurrentWeek(date: string, today: string | Date) {
  const start = weekStart(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const target = toDay(date);
  return target >= start && target < end;
}

export function computeMonthlyTarget(settings: LedgerSettings) {
  return settings.monthlyBase * ((settings.splitNeeds + settings.splitWants) / 100);
}

export function computeBucketTarget(settings: LedgerSettings, bucket: LedgerBucket) {
  const split = bucket === "needs" ? settings.splitNeeds : bucket === "wants" ? settings.splitWants : settings.splitSavings;
  return settings.monthlyBase * (split / 100);
}

export function computeMonthSpent(expenses: LedgerExpense[], today: string | Date) {
  const month = monthKey(today);
  return expenses
    .filter((expense) => expense.month === month && nonSavingsBuckets.includes(expense.bucket))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function computeWeeklyTarget(settings: LedgerSettings) {
  return computeMonthlyTarget(settings) / 4.345;
}

export function computeWeekSpent(expenses: LedgerExpense[], today: string | Date) {
  return expenses
    .filter((expense) => nonSavingsBuckets.includes(expense.bucket) && inCurrentWeek(expense.date, today))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function computeTodaySpent(expenses: LedgerExpense[], today: string | Date) {
  return expenses
    .filter((expense) => nonSavingsBuckets.includes(expense.bucket) && sameDay(expense.date, today))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function computeMonthlySavingsStreak(expenses: LedgerExpense[], today: string | Date) {
  const cursor = toDay(today);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 1);
  let streak = 0;

  while (true) {
    const month = monthKey(cursor);
    const saved = expenses
      .filter((expense) => expense.month === month && expense.bucket === "savings")
      .reduce((total, expense) => total + expense.amount, 0);

    if (saved < 1) {
      return streak;
    }

    streak += 1;
    cursor.setMonth(cursor.getMonth() - 1);
  }
}

export function computeYearEndProjection(expenses: LedgerExpense[], today: string | Date) {
  const current = toDay(today);
  const year = current.getFullYear();
  const currentMonthIndex = current.getMonth();
  const completedMonths = Math.max(currentMonthIndex, 0);
  const ytdSavings = expenses
    .filter((expense) => {
      const date = toDay(expense.date);
      return expense.bucket === "savings" && date.getFullYear() === year;
    })
    .reduce((total, expense) => total + expense.amount, 0);
  const averageMonthly = completedMonths ? ytdSavings / completedMonths : ytdSavings;

  return ytdSavings + averageMonthly * (11 - currentMonthIndex);
}

export function computeNetWorth(accounts: LedgerAccount[]) {
  const cash = accounts
    .filter((account) => account.category === "cash")
    .reduce((total, account) => total + account.balance, 0);
  const investments = accounts
    .filter((account) => account.category === "investment")
    .reduce((total, account) => total + account.balance, 0);

  return {
    cash,
    investments,
    total: cash + investments,
  };
}
