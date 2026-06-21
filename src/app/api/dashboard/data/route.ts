import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { computeBucketTarget, computeMonthSpent, computeMonthlyTarget, computeWeekSpent, computeWeeklyTarget } from "@/lib/ledger/calc";
import { dbAccount, dbExpense, dbSettings } from "@/lib/ledger/mapper";
import type { Database } from "@/lib/database.types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ProjectExpenseRow = Pick<Database["public"]["Tables"]["project_expenses"]["Row"], "amount">;

type DashboardProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"] & {
  project_expenses: ProjectExpenseRow[];
};

function currentMonthKey(today: Date) {
  return today.toISOString().slice(0, 7);
}

function currentDayKey(today: Date) {
  return today.toISOString().slice(0, 10);
}

function buildRealEstateSummary(projects: DashboardProjectRow[]) {
  const projectSummaries = projects.slice(0, 2).map((project) => {
    const spent = (project.project_expenses ?? []).reduce((total, expense) => total + Number(expense.amount ?? 0), 0);
    const total = Number(project.target_budget ?? 0);
    const progress = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : Math.max(0, Math.min(100, project.progress ?? 0));
    const variance = total - spent;

    return {
      id: project.id,
      name: project.name,
      spent,
      total,
      progress,
      variance,
      good: variance >= 0,
    };
  });

  return {
    hasData: projectSummaries.length > 0,
    statusLabel: projectSummaries.some((project) => !project.good) ? "Needs review" : "On track",
    projects: projectSummaries,
  };
}

export async function GET() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const userId = user.id;

  const [
    emailsResult,
    eventsResult,
    quotesResult,
    accountsResult,
    projectsResult,
    ledgerExpensesResult,
    ledgerAccountsResult,
    ledgerSettingsResult,
    todosResult,
    profileResult,
  ] = await Promise.all([
    admin
      .from("synced_emails")
      .select("gmail_message_id, thread_id, sender, subject, snippet, received_at, labels, created_at")
      .eq("user_id", userId)
      .contains("labels", ["INBOX"])
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(8),
    admin
      .from("synced_calendar_events")
      .select("google_event_id, calendar_id, title, starts_at, ends_at, location, attendees, created_at")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(8),
    admin
      .from("market_quotes")
      .select("symbol, price, change_percent, provider, fetched_at")
      .in("symbol", ["SPY", "QQQ", "VNQ"])
      .order("fetched_at", { ascending: false })
      .limit(12),
    admin
      .from("connected_accounts")
      .select("provider, account_email")
      .eq("user_id", userId)
      .eq("provider", "google"),
    admin
      .from("real_estate_projects")
      .select("id, name, target_budget, progress, project_expenses(amount)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("ledger_expenses")
      .select("id, label, amount, bucket, expense_date, month, tags, notes")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .limit(500),
    admin
      .from("ledger_accounts")
      .select("id, name, account_type, balance, category, institution, notes, last_updated_at")
      .eq("user_id", userId)
      .order("last_updated_at", { ascending: false }),
    admin
      .from("ledger_settings")
      .select("monthly_base, split_needs, split_wants, split_savings")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("todo_tasks")
      .select("id, title, project, due_date, completed, amount, flagged, someday, created_at")
      .eq("user_id", userId)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(12),
    admin.from("profiles").select("email, full_name, avatar_url").eq("id", userId).maybeSingle(),
  ]);

  const dataError =
    emailsResult.error ??
    eventsResult.error ??
    quotesResult.error ??
    accountsResult.error ??
    projectsResult.error ??
    ledgerExpensesResult.error ??
    ledgerAccountsResult.error ??
    ledgerSettingsResult.error ??
    profileResult.error;

  if (dataError) {
    return NextResponse.json(
      {
        error: dataError.message,
      },
      { status: 500 },
    );
  }

  const inboxes = (accountsResult.data ?? []).map((account) => ({
    provider: account.provider,
    email: account.account_email,
  }));
  const primaryInbox = inboxes[0]?.email ?? null;

  const latestQuotes = new Map<string, NonNullable<typeof quotesResult.data>[number]>();
  for (const quote of quotesResult.data ?? []) {
    if (!latestQuotes.has(quote.symbol)) {
      latestQuotes.set(quote.symbol, quote);
    }
  }

  const today = new Date();
  const todayKey = currentDayKey(today);
  const settings = dbSettings(ledgerSettingsResult.data);
  const ledgerExpenses = (ledgerExpensesResult.data ?? []).map(dbExpense);
  const ledgerAccounts = (ledgerAccountsResult.data ?? []).map(dbAccount);
  const month = currentMonthKey(today);
  const monthlySavings = ledgerExpenses
    .filter((expense) => expense.month === month && expense.bucket === "savings")
    .reduce((total, expense) => total + expense.amount, 0);
  const monthlyBase = settings.monthlyBase;
  const weeklyTarget = computeWeeklyTarget(settings);
  const monthlyTarget = computeMonthlyTarget(settings);
  const todos = todosResult.error ? [] : (todosResult.data ?? []);
  const openTodos = todos.filter((todo) => !todo.completed);

  return NextResponse.json({
    profile: {
      email: profileResult.data?.email ?? user.email ?? null,
      fullName: profileResult.data?.full_name ?? null,
      avatarUrl: profileResult.data?.avatar_url ?? null,
    },
    emails: (emailsResult.data ?? []).map((email) => ({
      ...email,
      account_email: primaryInbox,
    })),
    inboxes,
    events: eventsResult.data ?? [],
    quotes: Array.from(latestQuotes.values()),
    ledger: {
      hasData: ledgerExpenses.length > 0 || ledgerAccounts.length > 0 || monthlyBase > 0,
      monthLabel: new Intl.DateTimeFormat("en-US", { month: "long" }).format(today),
      savingsRate: monthlyBase > 0 ? Math.round((monthlySavings / monthlyBase) * 100) : null,
      savingsTarget: computeBucketTarget(settings, "savings"),
      weeklySpent: computeWeekSpent(ledgerExpenses, today),
      weeklyTarget,
      monthlySpent: computeMonthSpent(ledgerExpenses, today),
      monthlyTarget,
    },
    todos: {
      total: todos.length,
      open: openTodos.length,
      completed: todos.filter((todo) => todo.completed).length,
      todayOpen: openTodos.filter((todo) => todo.due_date === todayKey && !todo.someday).length,
      tasks: openTodos.slice(0, 3).map((todo) => ({
        id: todo.id,
        title: todo.title,
        project: todo.project,
        dueDate: todo.due_date,
        amount: todo.amount,
        flagged: todo.flagged,
      })),
    },
    realEstate: buildRealEstateSummary((projectsResult.data ?? []) as DashboardProjectRow[]),
    refreshedAt: new Date().toISOString(),
  });
}
