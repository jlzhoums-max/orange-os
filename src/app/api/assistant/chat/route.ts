import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { assistantModelLabel, homeModules, normalizeHomeLayout, type AssistantModelMode, type AssistantProvider } from "@/lib/assistant/modules";
import { computeBucketTarget, computeMonthSpent, computeMonthlyTarget, computeNetWorth, computeTodaySpent, computeWeekSpent, computeWeeklyTarget } from "@/lib/ledger/calc";
import { dbAccount, dbExpense, dbSettings } from "@/lib/ledger/mapper";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update_layout"),
    surface: z.literal("home"),
    modules: z.array(z.object({
      id: z.enum(["hero", "quick_capture", "focus", "inbox", "calendar", "market", "ai_brief", "data_connections"]),
      visible: z.boolean(),
    })),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("remember_preference"),
    key: z.string(),
    value: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string(),
    reason: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_ledger_expense"),
    label: z.string(),
    amount: z.number().positive(),
    bucket: z.enum(["needs", "wants", "savings"]),
    date: z.string(),
    tags: z.array(z.string()),
    notes: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_email_draft"),
    messageId: z.string(),
    body: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("email_message_action"),
    messageId: z.string(),
    action: z.enum(["archive", "unarchive", "markRead", "markUnread", "label", "snooze", "unsnooze"]),
    label: z.enum(["OrangeOS/Important", "OrangeOS/Needs Reply", "OrangeOS/Read Later", "OrangeOS/News", "OrangeOS/Tools"]).optional(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_calendar_event"),
    title: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    location: z.string(),
    description: z.string(),
    attendees: z.array(z.string()),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("developer_request"),
    request: z.string(),
    summary: z.string(),
  }),
]);

const responseSchema = z.object({
  message: z.string(),
  actions: z.array(actionSchema),
  memoryCandidates: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      reason: z.string(),
    }),
  ),
  developerModeRequired: z.boolean(),
  costNote: z.string(),
});

type LedgerExpenseAction = Extract<z.infer<typeof actionSchema>, { type: "create_ledger_expense" }>;

function normalizeProvider(value: unknown): AssistantProvider {
  return value === "anthropic" ? "anthropic" : "openai";
}

function normalizeMode(value: unknown): AssistantModelMode {
  if (value === "balanced" || value === "power") {
    return value;
  }

  return "cost";
}

function hasProviderKey(provider: AssistantProvider) {
  if (provider === "anthropic") {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  return Boolean(process.env.OPENAI_API_KEY);
}

function modelFor(provider: AssistantProvider, mode: AssistantModelMode) {
  const modelName = assistantModelLabel(provider, mode);
  return provider === "anthropic" ? anthropic(modelName) : openai(modelName);
}

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function ledgerExpenseFromMessage(content: string): LedgerExpenseAction | null {
  const amountMatch = content.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const expenseIntent = /\b(add|log|record|capture)\b/i.test(content)
    && /\b(expense|spend|spent|purchase|ledger|for|to)\b/i.test(content);

  if (!amountMatch || !expenseIntent) {
    return null;
  }

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const lower = content.toLowerCase();
  const bucket = /\b(saving|savings|investment|invest|debt)\b/i.test(lower)
    ? "savings"
    : /\b(want|wants|coffee|tea|restaurant|fun|dining)\b/i.test(lower)
    ? "wants"
    : "needs";
  const afterFor = content.match(/\bfor\s+(.+?)(?:\s+(?:to|as|in)\s+(?:needs|wants|savings))?$/i)?.[1];
  const label = (afterFor ?? content.replace(amountMatch[0], ""))
    .replace(/\b(add|log|record|capture|expense|spend|spent|purchase|ledger)\b/gi, "")
    .replace(/\b(to|as|in)\s+(needs|wants|savings)\b/gi, "")
    .trim();

  return {
    type: "create_ledger_expense",
    label: label || "Chéng zǐ expense",
    amount,
    bucket,
    date: localDateKey(),
    tags: ["cheng-zi"],
    notes: "Captured from Chéng zǐ.",
    summary: "Ready to add this Ledger expense.",
  };
}

function taskFromMessage(content: string) {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();
  const taskIntent = /\b(i need to|need to|remember to|remind me to|todo|to-do|task)\b/i.test(trimmed);

  if (!taskIntent) {
    return null;
  }

  const dueHint = /\b(tmrw|tomorrow)\b/i.test(trimmed)
    ? "tomorrow"
    : /\btoday\b/i.test(trimmed)
    ? "today"
    : null;
  const title = trimmed
    .replace(/^\s*(please\s+)?(i\s+need\s+to|need\s+to|remember\s+to|remind\s+me\s+to|add\s+)?/i, "")
    .replace(/\s+(as\s+a\s+)?(todo|to-do|task)\s*$/i, "")
    .replace(/\btmrw\b/gi, "tomorrow")
    .trim();

  if (!title || title.toLowerCase() === lower) {
    return null;
  }

  return {
    type: "create_task" as const,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    reason: dueHint ? `Captured from Chéng zǐ with due hint: ${dueHint}.` : "Captured from Chéng zǐ.",
    summary: dueHint ? `Ready to create this task for ${dueHint}.` : "Ready to create this task.",
  };
}

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const parsedMessages = z.array(messageSchema).safeParse(body.messages);

  if (!parsedMessages.success || parsedMessages.data.length === 0) {
    return NextResponse.json({ error: "Send at least one message." }, { status: 400 });
  }

  const provider = normalizeProvider(body.provider);
  const mode = normalizeMode(body.mode);

  if (!hasProviderKey(provider)) {
    return NextResponse.json(
      {
        error:
          provider === "anthropic"
            ? "ANTHROPIC_API_KEY is not configured. Claude can be selected after that key is added."
            : "OPENAI_API_KEY is not configured.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const userMessage = parsedMessages.data[parsedMessages.data.length - 1];
  const quickLedgerExpense = ledgerExpenseFromMessage(userMessage.content);
  const quickTask = taskFromMessage(userMessage.content);

  if (quickLedgerExpense) {
    const action = quickLedgerExpense;
    const message = `I can add ${action.label} for $${action.amount.toFixed(2)} to ${action.bucket}. Confirm it and I’ll put it in Ledger.`;

    await Promise.all([
      admin.from("assistant_messages").insert({
        user_id: user.id,
        role: "user",
        content: userMessage.content,
        provider,
        model: "deterministic-ledger",
      }),
      admin.from("assistant_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: message,
        provider,
        model: "deterministic-ledger",
        metadata: {
          actions: [action],
          memoryCandidates: [],
          developerModeRequired: false,
          costNote: "No model call used for this simple Ledger capture.",
        } satisfies Json,
      }),
    ]);

    return NextResponse.json({
      message,
      actions: [action],
      memoryCandidates: [],
      developerModeRequired: false,
      costNote: "No model call used for this simple Ledger capture.",
      provider,
      model: "deterministic-ledger",
      mode,
    });
  }

  if (quickTask) {
    const message = `I can make that a task: “${quickTask.title}.” Confirm it and I’ll add it to To-do.`;

    await Promise.all([
      admin.from("assistant_messages").insert({
        user_id: user.id,
        role: "user",
        content: userMessage.content,
        provider,
        model: "deterministic-task",
      }),
      admin.from("assistant_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: message,
        provider,
        model: "deterministic-task",
        metadata: {
          actions: [quickTask],
          memoryCandidates: [],
          developerModeRequired: false,
          costNote: "No model call used for this simple task capture.",
        } satisfies Json,
      }),
    ]);

    return NextResponse.json({
      message,
      actions: [quickTask],
      memoryCandidates: [],
      developerModeRequired: false,
      costNote: "No model call used for this simple task capture.",
      provider,
      model: "deterministic-task",
      mode,
    });
  }

  const [preferencesResult, layoutResult, reflectionsResult, dataResult] = await Promise.all([
    admin.from("assistant_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("assistant_layouts").select("*").eq("user_id", user.id).eq("surface", "home").maybeSingle(),
    admin
      .from("assistant_reflections")
      .select("reflection_date, summary, learned_preferences, command_patterns, shortcut_candidates, unresolved_questions")
      .eq("user_id", user.id)
      .order("reflection_date", { ascending: false })
      .limit(3),
    Promise.all([
      admin
        .from("synced_emails")
        .select("gmail_message_id, thread_id, sender, subject, snippet, received_at, labels, raw")
        .eq("user_id", user.id)
        .order("received_at", { ascending: false, nullsFirst: false })
        .limit(12),
      admin
        .from("synced_calendar_events")
        .select("title, starts_at, ends_at, location")
        .eq("user_id", user.id)
        .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order("starts_at", { ascending: true, nullsFirst: false })
        .limit(5),
      admin
        .from("ledger_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false })
        .limit(120),
      admin
        .from("ledger_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("category")
        .order("account_type")
        .order("name"),
      admin
        .from("ledger_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]),
  ]);

  if (preferencesResult.error || layoutResult.error || reflectionsResult.error) {
    return NextResponse.json({ error: preferencesResult.error?.message ?? layoutResult.error?.message ?? reflectionsResult.error?.message }, { status: 500 });
  }

  const [emails, events, ledgerExpenses, ledgerAccounts, ledgerSettings] = dataResult;
  const modelName = assistantModelLabel(provider, mode);
  const layout = normalizeHomeLayout(layoutResult.data?.modules);
  const preferences = preferencesResult.data ?? {
    assistant_name: "Chéng zǐ",
    developer_mode_enabled: false,
    memory: {},
  };
  const now = new Date();
  const ledgerExpenseData = (ledgerExpenses.data ?? []).map(dbExpense);
  const ledgerAccountData = (ledgerAccounts.data ?? []).map(dbAccount);
  const ledgerSettingData = dbSettings(ledgerSettings.data);
  const currentMonth = now.toISOString().slice(0, 7);
  const currentMonthExpenses = ledgerExpenseData.filter((expense) => expense.month === currentMonth);
  const bucketTotals = {
    needs: currentMonthExpenses.filter((expense) => expense.bucket === "needs").reduce((total, expense) => total + expense.amount, 0),
    wants: currentMonthExpenses.filter((expense) => expense.bucket === "wants").reduce((total, expense) => total + expense.amount, 0),
    savings: currentMonthExpenses.filter((expense) => expense.bucket === "savings").reduce((total, expense) => total + expense.amount, 0),
  };
  const netWorth = computeNetWorth(ledgerAccountData);
  const ledgerSummary = {
    currentMonth,
    todaySpent: computeTodaySpent(ledgerExpenseData, now),
    weekSpent: computeWeekSpent(ledgerExpenseData, now),
    weekTarget: computeWeeklyTarget(ledgerSettingData),
    monthSpent: computeMonthSpent(ledgerExpenseData, now),
    monthTarget: computeMonthlyTarget(ledgerSettingData),
    bucketTotals,
    bucketTargets: {
      needs: computeBucketTarget(ledgerSettingData, "needs"),
      wants: computeBucketTarget(ledgerSettingData, "wants"),
      savings: computeBucketTarget(ledgerSettingData, "savings"),
    },
    netWorth,
    recentExpenses: ledgerExpenseData.slice(0, 12),
  };

  await admin.from("assistant_messages").insert({
    user_id: user.id,
    role: "user",
    content: userMessage.content,
    provider,
    model: modelName,
  });

  const { output } = await generateText({
    model: modelFor(provider, mode),
    output: Output.object({ schema: responseSchema }),
    system:
      "You are Chéng zǐ, the Orange OS assistant. Be concise, practical, and warm. You can chat normally, reason over the supplied dashboard context, and propose safe actions. Never claim an action has been applied unless it is only a proposal. Layout changes, preference memory, task creation, Ledger expense creation, Calendar event creation, and developer/code-editing requests must be returned as actions for confirmation. Developer/code-editing requests require developer mode and should not include code patches here. For cost awareness, prefer small context, mention when a request is likely to need the stronger model, and do not invent prices.",
    prompt: JSON.stringify({
      messages: parsedMessages.data.slice(-10),
      userRequest: userMessage.content,
      currentProvider: provider,
      currentModelMode: mode,
      currentModel: modelName,
      localToday: now.toISOString().slice(0, 10),
      developerModeEnabled: preferences.developer_mode_enabled,
      longTermMemory: preferences.memory,
      homeModules,
      currentHomeLayout: layout,
      dashboardContext: {
        emails: emails.data ?? [],
        events: events.data ?? [],
        ledger: ledgerSummary,
      },
      recentNightlyLearning: reflectionsResult.data ?? [],
      rules: [
        "Before spending reasoning effort, check recentNightlyLearning for user habits, local shortcuts, and ambiguity preferences.",
        "If the user asks to rearrange, hide, show, or prioritize modules, propose an update_layout action with the complete home layout.",
        "If the user states a durable preference, include a remember_preference action and/or memory candidate.",
        "If the user asks to log, add, or record a purchase/spend/expense, propose create_ledger_expense. Choose needs for essentials, wants for discretionary spending, and savings for transfers/investments/debt payoff. Use today's local date if no date is supplied.",
        "If the user asks about Ledger spending, budget pace, totals, buckets, recent expenses, or net worth, answer directly from dashboardContext. Do not give financial advice; use the data only for awareness and pacing.",
        "If the user asks about inbox state, summarize or prioritize from dashboardContext.emails and do not create actions unless the user asks to change email or draft a reply.",
        "If the user asks to draft a reply, propose create_email_draft with a concise draft body and the best matching messageId. Never propose sending email.",
        "If the user asks to archive, mark read/unread, label, snooze, or unsnooze email, propose email_message_action with the best matching messageId. Label actions require an OrangeOS/* label.",
        "When selecting an email, prefer explicit subject/sender matches; otherwise use the most recent likely matching email and mention what you matched in the summary.",
        "If the user asks to schedule, book, add, or create a calendar event, propose create_calendar_event. Use ISO datetimes, localToday as the date anchor, and a reasonable one-hour duration if no end time is supplied. Include attendees only when explicit email addresses are supplied.",
        "If the user asks about schedule, meetings, agenda, conflicts, or free time, answer directly from dashboardContext.events. Do not create a calendar event unless requested.",
        "If the user asks to fix or edit code, return developerModeRequired true and a developer_request action.",
        "If no action is needed, actions should be an empty array.",
      ],
    }),
  });

  await admin.from("assistant_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: output.message,
    provider,
    model: modelName,
    metadata: {
      actions: output.actions,
      memoryCandidates: output.memoryCandidates,
      developerModeRequired: output.developerModeRequired,
      costNote: output.costNote,
    } satisfies Json,
  });

  return NextResponse.json({
    message: output.message,
    actions: output.actions,
    memoryCandidates: output.memoryCandidates,
    developerModeRequired: output.developerModeRequired,
    costNote: output.costNote,
    provider,
    model: modelName,
    mode,
  });
}
