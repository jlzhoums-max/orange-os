import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { assistantModelLabel, type AssistantModelMode, type AssistantProvider } from "@/lib/assistant/modules";
import type { Json } from "@/lib/database.types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const reflectionSchema = z.object({
  summary: z.string(),
  learnedPreferences: z.record(z.string(), z.string()),
  commandPatterns: z.array(
    z.object({
      pattern: z.string(),
      meaning: z.string(),
      suggestedLocalRule: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
  shortcutCandidates: z.array(
    z.object({
      name: z.string(),
      triggerExamples: z.array(z.string()),
      action: z.string(),
      expectedCreditSavings: z.enum(["low", "medium", "high"]),
    }),
  ),
  codeNotes: z.array(
    z.object({
      area: z.string(),
      note: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      requiresApproval: z.literal(true),
    }),
  ),
  unresolvedQuestions: z.array(z.string()),
});

type ReflectionOutput = z.infer<typeof reflectionSchema>;

function centralDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function centralDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00-05:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    end: end.toISOString(),
    start: start.toISOString(),
  };
}

function reflectionProvider(): AssistantProvider {
  const configured = process.env.ASSISTANT_REFLECTION_PROVIDER;

  if (configured === "openai" || configured === "anthropic") {
    return configured;
  }

  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai";
}

function reflectionMode(): AssistantModelMode {
  const configured = process.env.ASSISTANT_REFLECTION_MODEL_MODE;

  if (configured === "cost" || configured === "balanced" || configured === "power") {
    return configured;
  }

  return "balanced";
}

function hasReflectionKey(provider: AssistantProvider) {
  return provider === "anthropic" ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(process.env.OPENAI_API_KEY);
}

function reflectionModel(provider: AssistantProvider, mode: AssistantModelMode) {
  const modelName = assistantModelLabel(provider, mode);

  return {
    label: modelName,
    model: provider === "anthropic" ? anthropic(modelName) : openai(modelName),
  };
}

function compactMessages(messages: Array<{ role: string; content: string; metadata: Json; created_at: string }>) {
  return messages.slice(-40).map((message) => ({
    at: message.created_at,
    content: message.content.slice(0, 900),
    metadata: message.metadata,
    role: message.role,
  }));
}

function mergeMemory(current: Json, learned: ReflectionOutput["learnedPreferences"]) {
  const base = current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, Json>
    : {};

  return {
    ...base,
    ...learned,
  } satisfies Json;
}

export async function runDailyReflectionForUser(userId: string, options: { dateKey?: string; force?: boolean } = {}) {
  const admin = getSupabaseAdmin();
  const dateKey = options.dateKey ?? centralDateKey(new Date(Date.now() - 60 * 60 * 1000));

  if (!options.force) {
    const { data: existing, error: existingError } = await admin
      .from("assistant_reflections")
      .select("id")
      .eq("user_id", userId)
      .eq("reflection_date", dateKey)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      return { created: false, dateKey, reflectionId: existing.id };
    }
  }

  const provider = reflectionProvider();
  const mode = reflectionMode();

  if (!hasReflectionKey(provider)) {
    return { created: false, dateKey, skipped: `Missing ${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}` };
  }

  const { end, start } = centralDayRange(dateKey);
  const [preferences, messages, tasks, expenses, events, emails, priorReflections] = await Promise.all([
    admin
      .from("assistant_preferences")
      .select("memory, default_provider, default_model_mode, developer_mode_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("assistant_messages")
      .select("role, content, metadata, created_at")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .limit(80),
    admin
      .from("assistant_tasks")
      .select("title, reason, status, created_at, completed_at")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .limit(60),
    admin
      .from("ledger_expenses")
      .select("label, amount, bucket, expense_date, tags, notes, created_at")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .limit(80),
    admin
      .from("synced_calendar_events")
      .select("title, starts_at, ends_at, location, status")
      .eq("user_id", userId)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at", { ascending: true })
      .limit(40),
    admin
      .from("synced_emails")
      .select("sender, subject, received_at, labels")
      .eq("user_id", userId)
      .gte("received_at", start)
      .lt("received_at", end)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(40),
    admin
      .from("assistant_reflections")
      .select("reflection_date, summary, learned_preferences, command_patterns, shortcut_candidates")
      .eq("user_id", userId)
      .lt("reflection_date", dateKey)
      .order("reflection_date", { ascending: false })
      .limit(3),
  ]);

  const sourceErrors = [preferences, messages, tasks, expenses, events, emails, priorReflections]
    .map((result) => result.error?.message)
    .filter(Boolean);

  if (sourceErrors.length) {
    throw new Error(sourceErrors.join("; "));
  }

  const { label: modelName, model } = reflectionModel(provider, mode);
  const result = await generateText({
    model,
    output: Output.object({ schema: reflectionSchema }),
    system:
      "You are Chéng zǐ's nightly learning process. Compress one day of Orange OS activity into durable, useful memory. Prefer concrete local shortcuts that reduce future model calls. Do not recommend automatic code changes; code notes must be approval-required suggestions. Avoid sensitive raw detail unless it is necessary for a preference or pattern.",
    prompt: JSON.stringify({
      dateKey,
      currentMemory: preferences.data?.memory ?? {},
      priorReflections: priorReflections.data ?? [],
      activity: {
        assistantMessages: compactMessages(messages.data ?? []),
        calendarEvents: events.data ?? [],
        emails: emails.data ?? [],
        ledgerExpenses: expenses.data ?? [],
        tasks: tasks.data ?? [],
      },
      requestedOutput:
        "Identify repeated command patterns, personal preferences, shortcut candidates that can run without AI, unresolved questions to ask later, and developer notes for review only.",
    }),
  });
  const output = result.output;
  const { data: reflection, error: reflectionError } = await admin
    .from("assistant_reflections")
    .upsert(
      {
        user_id: userId,
        reflection_date: dateKey,
        summary: output.summary,
        learned_preferences: output.learnedPreferences as Json,
        command_patterns: output.commandPatterns as Json,
        shortcut_candidates: output.shortcutCandidates as Json,
        code_notes: output.codeNotes as Json,
        unresolved_questions: output.unresolvedQuestions as Json,
        provider,
        model: modelName,
        token_usage: (result.usage ?? {}) as Json,
      },
      { onConflict: "user_id,reflection_date" },
    )
    .select("id")
    .single();

  if (reflectionError) {
    throw new Error(reflectionError.message);
  }

  const mergedMemory = mergeMemory(preferences.data?.memory ?? {}, output.learnedPreferences);
  const { error: preferencesError } = await admin
    .from("assistant_preferences")
    .upsert(
      {
        user_id: userId,
        assistant_name: "Chéng zǐ",
        memory: mergedMemory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (preferencesError) {
    throw new Error(preferencesError.message);
  }

  return {
    created: true,
    dateKey,
    model: modelName,
    provider,
    reflectionId: reflection.id,
  };
}
