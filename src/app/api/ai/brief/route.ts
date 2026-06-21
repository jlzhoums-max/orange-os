import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabasePublicEnv } from "@/lib/env";
import { computeMonthSpent, computeMonthlySavingsStreak, computeMonthlyTarget, computeNetWorth, computeWeekSpent } from "@/lib/ledger/calc";
import { dbAccount, dbExpense, dbSettings } from "@/lib/ledger/mapper";
import type { Json } from "@/lib/database.types";

const briefSchema = z.object({
  headline: z.string(),
  narrative: z.string(),
  focusItems: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      tone: z.enum(["neutral", "good", "warning", "danger"]),
    }),
  ),
  suggestedTasks: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
      priority: z.enum(["High", "Medium", "Low"]),
      source: z.string(),
    }),
  ),
  replyDrafts: z.array(
    z.object({
      recipient: z.string(),
      subject: z.string(),
      draft: z.string(),
      confirmationRequired: z.literal(true),
    }),
  ),
  projectUpdates: z.array(
    z.object({
      project: z.string(),
      update: z.string(),
      nextAction: z.string(),
      risk: z.enum(["Low", "Medium", "High"]),
    }),
  ),
});

function getDayPart(date: Date) {
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
  const { data: brief } = await admin
    .from("ai_briefs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ brief });
}

export async function POST() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const userId = user.id;
  const [emails, events, projects, quotes, ledgerExpenses, ledgerAccounts, ledgerSettings] = await Promise.all([
    admin
      .from("synced_emails")
      .select("sender, subject, snippet, received_at, labels")
      .eq("user_id", userId)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(10),
    admin
      .from("synced_calendar_events")
      .select("title, starts_at, ends_at, location")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(10),
    admin
      .from("real_estate_projects")
      .select("name, status, risk, estimated_value, purchase_price, target_budget, progress, due, next_action, notes, project_expenses(category, vendor, amount, expense_date, status, notes)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(8),
    admin
      .from("market_quotes")
      .select("symbol, price, change_percent, provider, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(12),
    admin
      .from("ledger_expenses")
      .select("*")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .limit(120),
    admin
      .from("ledger_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("category")
      .order("account_type")
      .order("name"),
    admin
      .from("ledger_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const now = new Date();
  const dayPart = getDayPart(now);
  const ledgerExpenseData = (ledgerExpenses.data ?? []).map(dbExpense);
  const ledgerAccountData = (ledgerAccounts.data ?? []).map(dbAccount);
  const ledgerSettingData = dbSettings(ledgerSettings.data);
  const ledgerNetWorth = computeNetWorth(ledgerAccountData);
  const ledgerSummary = {
    monthlyTarget: computeMonthlyTarget(ledgerSettingData),
    monthSpent: computeMonthSpent(ledgerExpenseData, now),
    weekSpent: computeWeekSpent(ledgerExpenseData, now),
    savingsStreak: computeMonthlySavingsStreak(ledgerExpenseData, now),
    netWorth: ledgerNetWorth.total,
    cash: ledgerNetWorth.cash,
    investments: ledgerNetWorth.investments,
    recentEntries: ledgerExpenseData.slice(0, 8),
  };
  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL || "gpt-5.5"),
    output: Output.object({ schema: briefSchema }),
    system:
      "You are JU OS, a very proactive but careful personal operating assistant. Use only the supplied dashboard data. Draft replies and project updates, but never imply that anything has been sent or changed. Every reply draft requires user confirmation before sending. Be concise, specific, and operational.",
    prompt: JSON.stringify({
      localTime: now.toISOString(),
      dayPart,
      emails: emails.data ?? [],
      events: events.data ?? [],
      projects: projects.data ?? [],
      quotes: quotes.data ?? [],
      ledger: ledgerSummary,
      requestedBehavior:
        "Produce a daily brief with concrete priorities, task suggestions, reply drafts, real estate project update suggestions, and Ledger cash-flow awareness when relevant. Do not give financial advice; use Ledger data only for awareness, pacing, and task suggestions.",
    }),
  });

  const { data: brief, error: insertError } = await admin
    .from("ai_briefs")
    .insert({
      user_id: userId,
      day_part: dayPart,
      headline: output.headline,
      narrative: output.narrative,
      focus_items: output.focusItems as Json,
      suggested_tasks: output.suggestedTasks as Json,
      reply_drafts: output.replyDrafts as Json,
      project_updates: output.projectUpdates as Json,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ brief });
}
