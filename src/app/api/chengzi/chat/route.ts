import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { computeMonthSpent, computeNetWorth, computeWeekSpent } from "@/lib/ledger/calc";
import { dbAccount, dbExpense, dbSettings } from "@/lib/ledger/mapper";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

export async function POST(request: Request) {
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

  const body = (await request.json()) as { messages?: ChatMessage[]; mode?: string };
  const messages = (body.messages ?? []).slice(-8);
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text?.trim();

  if (!latestUserMessage) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const userId = user.id;
  const [emails, events, projects, quotes, ledgerExpenses, ledgerAccounts, ledgerSettings] = await Promise.all([
    admin
      .from("synced_emails")
      .select("sender, subject, snippet, received_at, labels")
      .eq("user_id", userId)
      .contains("labels", ["INBOX"])
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(8),
    admin
      .from("synced_calendar_events")
      .select("title, starts_at, ends_at, location")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(8),
    admin
      .from("real_estate_projects")
      .select("name, status, risk, target_budget, progress, due, next_action, notes")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(8),
    admin
      .from("market_quotes")
      .select("symbol, price, change_percent, provider, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(10),
    admin
      .from("ledger_expenses")
      .select("*")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .limit(80),
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
  const ledgerExpenseData = (ledgerExpenses.data ?? []).map(dbExpense);
  const ledgerAccountData = (ledgerAccounts.data ?? []).map(dbAccount);
  const ledgerSettingsData = dbSettings(ledgerSettings.data);
  const ledgerNetWorth = computeNetWorth(ledgerAccountData);

  const { text } = await generateText({
    model: openai(process.env.OPENAI_MODEL || "gpt-5.5"),
    system:
      "You are Cheng Zi, the official JU OS assistant. Be concise, calm, and operational. Use only the provided JU OS context. You may draft, summarize, and suggest next actions, but never claim that you sent email, changed calendars, moved money, or edited records. If an action requires confirmation, say so.",
    prompt: JSON.stringify({
      mode: body.mode ?? "Ask",
      localTime: now.toISOString(),
      conversation: messages,
      question: latestUserMessage,
      context: {
        emails: emails.data ?? [],
        events: events.data ?? [],
        projects: projects.data ?? [],
        quotes: quotes.data ?? [],
        ledger: {
          monthSpent: computeMonthSpent(ledgerExpenseData, now),
          weekSpent: computeWeekSpent(ledgerExpenseData, now),
          monthlyBase: ledgerSettingsData.monthlyBase,
          netWorth: ledgerNetWorth.total,
          cash: ledgerNetWorth.cash,
          investments: ledgerNetWorth.investments,
          recentEntries: ledgerExpenseData.slice(0, 8),
        },
      },
    }),
  });

  return NextResponse.json({ message: text });
}
