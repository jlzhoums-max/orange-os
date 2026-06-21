import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bot, BrainCircuit, Code2, Lightbulb, MemoryStick, Route, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type ReflectionRow = {
  id: string;
  reflection_date: string;
  summary: string;
  learned_preferences: Json;
  command_patterns: Json;
  shortcut_candidates: Json;
  code_notes: Json;
  unresolved_questions: Json;
  provider: string | null;
  model: string | null;
  created_at: string;
};

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json>
    : {};
}

function asArray<T extends Record<string, Json>>(value: Json | undefined): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00-05:00`));
}

function jsonText(value: Json) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export default async function ChengZiPage() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return (
      <AppChrome active="AI">
        <div className="mx-auto max-w-[1200px]">
          <section className="os-card p-6">
            <p className="font-semibold">Supabase is not configured.</p>
          </section>
        </div>
      </AppChrome>
    );
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const admin = getSupabaseAdmin();
  const [preferencesResult, reflectionsResult] = await Promise.all([
    admin
      .from("assistant_preferences")
      .select("memory, default_provider, default_model_mode, developer_mode_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("assistant_reflections")
      .select("id, reflection_date, summary, learned_preferences, command_patterns, shortcut_candidates, code_notes, unresolved_questions, provider, model, created_at")
      .eq("user_id", user.id)
      .order("reflection_date", { ascending: false })
      .limit(14),
  ]);

  if (preferencesResult.error || reflectionsResult.error) {
    return (
      <AppChrome active="AI">
        <div className="mx-auto max-w-[1200px]">
          <section className="os-card p-6">
            <p className="font-semibold text-[var(--danger)]">
              {preferencesResult.error?.message ?? reflectionsResult.error?.message}
            </p>
          </section>
        </div>
      </AppChrome>
    );
  }

  const memory = asRecord(preferencesResult.data?.memory);
  const reflections = (reflectionsResult.data ?? []) as ReflectionRow[];
  const latest = reflections[0];
  const latestPatterns = asArray<{ pattern?: Json; meaning?: Json; suggestedLocalRule?: Json; confidence?: Json }>(latest?.command_patterns);
  const latestShortcuts = asArray<{ name?: Json; triggerExamples?: Json; action?: Json; expectedCreditSavings?: Json }>(latest?.shortcut_candidates);
  const codeNotes = reflections.flatMap((reflection) =>
    asArray<{ area?: Json; note?: Json; priority?: Json; requiresApproval?: Json }>(reflection.code_notes).map((note) => ({
      ...note,
      reflectionDate: reflection.reflection_date,
    })),
  );
  const unresolvedQuestions = reflections.flatMap((reflection) =>
    (Array.isArray(reflection.unresolved_questions) ? reflection.unresolved_questions : []).map((question) => ({
      question,
      reflectionDate: reflection.reflection_date,
    })),
  );
  const statItems = [
    ["Memory Items", Object.keys(memory).length.toString(), MemoryStick],
    ["Reflections", reflections.length.toString(), BrainCircuit],
    ["Shortcuts", latestShortcuts.length.toString(), Route],
    ["Code Notes", codeNotes.length.toString(), Code2],
  ];

  return (
    <AppChrome active="AI">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <header className="grid gap-5 lg:grid-cols-[1fr_0.72fr] lg:items-stretch">
          <section className="os-card os-watermark overflow-hidden p-6 sm:p-8">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
              href="/"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <div className="mt-8 flex max-w-3xl flex-col gap-4">
              <div className="os-icon-bubble flex h-14 w-14 items-center justify-center">
                <Bot size={24} />
              </div>
              <h1 className="text-4xl font-bold tracking-normal text-balance sm:text-5xl">
                Chéng zǐ Memory
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Review what Chéng zǐ learned overnight, which shortcuts can save credits, and which developer notes need human approval.
              </p>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {statItems.map(([label, value, Icon]) => (
              <div className="os-card-soft flex items-center gap-3 p-4" key={label as string}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value as string}</p>
                  <p className="text-sm text-[var(--muted)]">{label as string}</p>
                </div>
              </div>
            ))}
          </section>
        </header>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-5">
            <Panel icon={MemoryStick} title="Long-Term Memory">
              {Object.keys(memory).length ? (
                <div className="grid gap-2">
                  {Object.entries(memory).map(([key, value]) => (
                    <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3" key={key}>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{key}</p>
                      <p className="mt-1 text-sm leading-6">{jsonText(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No durable memory yet. Chéng zǐ will add compact preferences after nightly reflection." />
              )}
            </Panel>

            <Panel icon={Lightbulb} title="Shortcut Candidates">
              {latestShortcuts.length ? (
                <div className="grid gap-3">
                  {latestShortcuts.map((shortcut, index) => (
                    <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3" key={`${shortcut.name}-${index}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{jsonText(shortcut.name ?? "Shortcut")}</p>
                        <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                          {jsonText(shortcut.expectedCreditSavings ?? "unknown")} savings
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{jsonText(shortcut.action ?? "")}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Examples: {Array.isArray(shortcut.triggerExamples) ? shortcut.triggerExamples.map(jsonText).join(", ") : "None yet"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No shortcut candidates from the latest reflection yet." />
              )}
            </Panel>
          </div>

          <div className="grid gap-5">
            <Panel icon={BrainCircuit} title="Latest Reflection">
              {latest ? (
                <div className="grid gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {formatDate(latest.reflection_date)} · {latest.provider ?? "provider"} · {latest.model ?? "model"}
                    </p>
                    <p className="mt-2 text-base leading-7">{latest.summary}</p>
                  </div>
                  <div className="grid gap-2">
                    {latestPatterns.map((pattern, index) => (
                      <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3" key={`${pattern.pattern}-${index}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{jsonText(pattern.pattern ?? "Pattern")}</p>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                            {jsonText(pattern.confidence ?? "unknown")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{jsonText(pattern.meaning ?? "")}</p>
                        <p className="mt-2 text-sm leading-6">{jsonText(pattern.suggestedLocalRule ?? "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="No nightly reflection has run yet." />
              )}
            </Panel>

            <Panel icon={Code2} title="Developer Notes">
              {codeNotes.length ? (
                <div className="grid gap-3">
                  {codeNotes.map((note, index) => (
                    <div className="rounded-xl border border-[rgba(244,126,22,0.24)] bg-[rgba(255,244,230,0.7)] p-3" key={`${note.reflectionDate}-${index}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{jsonText(note.area ?? "Code note")}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                          {jsonText(note.priority ?? "medium")} priority
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{jsonText(note.note ?? "")}</p>
                      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                        Approval required · {formatDate(note.reflectionDate)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No code notes awaiting review." />
              )}
            </Panel>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel icon={Sparkles} title="Recent Reflections">
            {reflections.length ? (
              <div className="grid gap-3">
                {reflections.map((reflection) => (
                  <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3" key={reflection.id}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {formatDate(reflection.reflection_date)}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm leading-6">{reflection.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Nightly reflection history will appear here." />
            )}
          </Panel>

          <Panel icon={Route} title="Open Questions">
            {unresolvedQuestions.length ? (
              <div className="grid gap-2">
                {unresolvedQuestions.map((item, index) => (
                  <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3" key={`${item.reflectionDate}-${index}`}>
                    <p className="text-sm leading-6">{jsonText(item.question)}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(item.reflectionDate)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No open questions from Chéng zǐ right now." />
            )}
          </Panel>
        </section>
      </div>
    </AppChrome>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="os-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(244,126,22,0.11)] text-[var(--accent)]">
          <Icon size={18} />
        </div>
        <h2 className="text-xl font-bold tracking-normal">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-white/50 p-4 text-sm leading-6 text-[var(--muted)]">
      {text}
    </div>
  );
}
