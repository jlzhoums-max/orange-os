"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Code2,
  Loader2,
  MessageSquareText,
  Minus,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { AssistantAction, AssistantModelMode, AssistantProvider, DashboardLayoutItem } from "@/lib/assistant/modules";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type AssistantState = {
  preferences: {
    assistant_name: string;
    default_provider: AssistantProvider;
    default_model_mode: AssistantModelMode;
    developer_mode_enabled: boolean;
  };
  recentMessages: AssistantMessage[];
};

type ChatResponse = {
  message: string;
  actions: AssistantAction[];
  developerModeRequired: boolean;
  costNote: string;
  provider: AssistantProvider;
  model: string;
  mode: AssistantModelMode;
};

type AssistantActivity = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

const welcomeMessage: AssistantMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m Chéng zǐ. I can chat, reason over Orange OS, rearrange dashboard modules with approval, remember preferences, and queue developer-mode fixes.",
};
const activityStorageKey = "orange-os.cheng-zi.activity.v1";
let localIdCounter = 0;

function nextLocalId(prefix: string) {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

function localTaskTitleFromMessage(content: string) {
  const trimmed = content.trim();
  const taskIntent = /\b(add|create|make|capture)\b/i.test(trimmed) && /\b(task|todo|to-do)\b/i.test(trimmed);

  if (!taskIntent) {
    return null;
  }

  const title = trimmed
    .replace(/^\s*(please\s+)?(add|create|make|capture)\s+/i, "")
    .replace(/\s+(as|to)\s+a?\s*(task|todo|to-do)\s*$/i, "")
    .replace(/\s+(task|todo|to-do)\s*$/i, "")
    .trim();

  return title || trimmed;
}

function localExpenseFromMessage(content: string) {
  const amountMatch = content.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const expenseIntent = /\b(add|log|record|capture)\b/i.test(content) && /\b(expense|spend|spent|purchase|ledger|for)\b/i.test(content);

  if (!amountMatch || !expenseIntent) {
    return null;
  }

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const lower = content.toLowerCase();
  const bucket = lower.includes("saving") || lower.includes("investment") || lower.includes("debt")
    ? "savings"
    : lower.includes("want") || lower.includes("coffee") || lower.includes("restaurant") || lower.includes("fun")
    ? "wants"
    : "needs";
  const afterFor = content.match(/\bfor\s+(.+?)(?:\s+(?:to|as|in)\s+(?:needs|wants|savings))?$/i)?.[1];
  const label = (afterFor ?? content.replace(amountMatch[0], "")).replace(/\b(add|log|record|capture|expense|spend|spent|purchase|ledger)\b/gi, "").trim();

  return {
    label: label || "Chéng zǐ expense",
    amount,
    bucket,
    date: new Date().toISOString().slice(0, 10),
    tags: ["cheng-zi"],
    notes: "Captured locally from Chéng zǐ while signed out.",
  };
}

function localCalendarEventFromMessage(content: string) {
  const scheduleIntent = /\b(schedule|book|add|create)\b/i.test(content) && /\b(meeting|event|calendar|call)\b/i.test(content);

  if (!scheduleIntent) {
    return null;
  }

  const now = new Date();
  const start = new Date(now);
  start.setHours(now.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  const title = content
    .replace(/\b(schedule|book|add|create)\b/gi, "")
    .replace(/\b(on|to)?\s*(my\s+)?calendar\b/gi, "")
    .trim();

  return {
    title: title || "Chéng zǐ event",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    location: "",
    description: "Captured locally from Chéng zǐ while signed out.",
    attendees: [],
  };
}

function actionLabel(action: AssistantAction) {
  if (action.type === "update_layout") {
    return "Apply layout";
  }

  if (action.type === "remember_preference") {
    return "Remember";
  }

  if (action.type === "create_task") {
    return "Create task";
  }

  if (action.type === "create_ledger_expense") {
    return "Add expense";
  }

  if (action.type === "create_email_draft") {
    return "Create draft";
  }

  if (action.type === "email_message_action") {
    if (action.action === "archive") {
      return "Archive";
    }

    if (action.action === "label") {
      return "Apply label";
    }

    return "Apply email action";
  }

  if (action.type === "create_calendar_event") {
    return "Create event";
  }

  return "Queue developer request";
}

function actionSummary(action: AssistantAction) {
  if (action.type === "update_layout") {
    const hidden = action.modules.filter((module) => !module.visible).map((module) => module.id.replaceAll("_", " "));
    return hidden.length ? `${action.summary} Hidden: ${hidden.join(", ")}.` : action.summary;
  }

  if (action.type === "create_ledger_expense") {
    return `${action.summary} ${action.label}: $${action.amount.toFixed(2)} in ${action.bucket}.`;
  }

  if (action.type === "create_email_draft") {
    return `${action.summary} Draft will be created in Gmail, not sent.`;
  }

  if (action.type === "email_message_action") {
    return `${action.summary} Action: ${action.action}${action.label ? ` (${action.label})` : ""}.`;
  }

  if (action.type === "create_calendar_event") {
    return `${action.summary} ${action.title}: ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(action.startsAt))}.`;
  }

  return action.summary;
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<AssistantProvider>("openai");
  const [mode, setMode] = useState<AssistantModelMode>("cost");
  const [developerMode, setDeveloperMode] = useState(false);
  const [pendingActions, setPendingActions] = useState<AssistantAction[]>([]);
  const [activity, setActivity] = useState<AssistantActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const chatMessages = useMemo(
    () => messages.filter((message) => message.id !== "welcome").map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const loadState = useCallback(async () => {
    const response = await fetch("/api/assistant/state");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as AssistantState;
    setProvider(payload.preferences.default_provider ?? "openai");
    setMode(payload.preferences.default_model_mode ?? "cost");
    setDeveloperMode(Boolean(payload.preferences.developer_mode_enabled));
    setMessages(payload.recentMessages.length ? payload.recentMessages : [welcomeMessage]);
  }, []);

  const savePreferences = useCallback(async (next: Partial<{ provider: AssistantProvider; mode: AssistantModelMode; developerMode: boolean }>) => {
    const nextProvider = next.provider ?? provider;
    const nextMode = next.mode ?? mode;
    const nextDeveloperMode = next.developerMode ?? developerMode;

    setProvider(nextProvider);
    setMode(nextMode);
    setDeveloperMode(nextDeveloperMode);

    await fetch("/api/assistant/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_provider: nextProvider,
        default_model_mode: nextMode,
        developer_mode_enabled: nextDeveloperMode,
      }),
    });
  }, [developerMode, mode, provider]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadState();
      const stored = window.localStorage.getItem(activityStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AssistantActivity[];
          if (Array.isArray(parsed)) {
            setActivity(parsed.slice(0, 8));
          }
        } catch {
          window.localStorage.removeItem(activityStorageKey);
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    window.localStorage.setItem(activityStorageKey, JSON.stringify(activity.slice(0, 8)));
  }, [activity]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingActions, open]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: nextLocalId("local-user"),
      role: "user",
      content,
    };

    setInput("");
    setLoading(true);
    setStatus(null);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          messages: [...chatMessages, { role: "user", content }],
        }),
      });
      const payload = (await response.json()) as Partial<ChatResponse> & { error?: string };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Chéng zǐ could not respond.");
      }

      setMessages((current) => [
        ...current,
        {
          id: nextLocalId("local-assistant"),
          role: "assistant",
          content: payload.message ?? "",
        },
      ]);
      setPendingActions(payload.actions ?? []);
      setStatus(payload.costNote ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      const localTaskTitle = message === "Unauthorized" ? localTaskTitleFromMessage(content) : null;
      const localExpense = message === "Unauthorized" ? localExpenseFromMessage(content) : null;
      const localCalendarEvent = message === "Unauthorized" ? localCalendarEventFromMessage(content) : null;

      if (localTaskTitle) {
        window.dispatchEvent(new CustomEvent("orange-os-local-task-create", {
          detail: {
            title: localTaskTitle,
            notes: "Captured locally from Chéng zǐ while signed out.",
            labels: ["cheng-zi"],
          },
        }));
        setMessages((current) => [
          ...current,
          {
            id: nextLocalId("local-offline-task"),
            role: "assistant",
            content: `You are not signed in, so I added "${localTaskTitle}" as a local To-do task. Sign in when you want Chéng zǐ tasks to sync through Supabase.`,
          },
        ]);
        setStatus("Local task created. Cloud sync needs sign-in.");
        recordActivity("Local task created", localTaskTitle);
        return;
      }

      if (localExpense) {
        window.dispatchEvent(new CustomEvent("orange-os-local-ledger-expense-create", { detail: localExpense }));
        setMessages((current) => [
          ...current,
          {
            id: nextLocalId("local-offline-expense"),
            role: "assistant",
            content: `You are not signed in, so I added "${localExpense.label}" as a local Ledger expense for $${localExpense.amount.toFixed(2)}. Sign in when you want Ledger changes to sync through Supabase.`,
          },
        ]);
        setStatus("Local Ledger expense created. Cloud sync needs sign-in.");
        recordActivity("Local Ledger expense", `${localExpense.label} - $${localExpense.amount.toFixed(2)}`);
        return;
      }

      if (localCalendarEvent) {
        window.dispatchEvent(new CustomEvent("orange-os-local-calendar-event-create", { detail: localCalendarEvent }));
        setMessages((current) => [
          ...current,
          {
            id: nextLocalId("local-offline-calendar"),
            role: "assistant",
            content: `You are not signed in, so I staged "${localCalendarEvent.title}" as a local calendar event. Sign in when you want Calendar changes to sync through Google.`,
          },
        ]);
        setStatus("Local calendar event staged. Google sync needs sign-in.");
        recordActivity("Local calendar event", localCalendarEvent.title);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: nextLocalId("local-error"),
          role: "assistant",
          content: message === "Unauthorized"
            ? "You are not signed in yet. I can show the panel, but cloud-backed chat actions need you to complete login first."
            : message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: AssistantAction) {
    setStatus("Applying confirmed change...");
    const response = await fetch("/api/assistant/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const payload = await response.json() as {
      draft?: { draftId: string; messageId: string };
      email?: { action: string; messageId: string };
      calendarEvent?: { id: string; title: string; startsAt: string; endsAt: string; location: string };
      error?: string;
      expense?: unknown;
      layout?: DashboardLayoutItem[];
      note?: string;
    };

    if (!response.ok) {
      setStatus(payload.error ?? "Action failed.");
      return;
    }

    setPendingActions((current) => current.filter((item) => item !== action));
    setStatus(payload.note ?? "Confirmed change applied.");
    recordActivity(actionLabel(action), actionSummary(action));

    if (action.type === "update_layout") {
      window.dispatchEvent(new CustomEvent("orange-os-layout-updated", { detail: payload.layout }));
    }

    if (action.type === "create_ledger_expense" && payload.expense) {
      window.dispatchEvent(new CustomEvent("orange-os-ledger-expense-created", { detail: payload.expense }));
    }

    if (action.type === "create_calendar_event" && payload.calendarEvent) {
      window.dispatchEvent(new CustomEvent("orange-os-calendar-event-created", { detail: payload.calendarEvent }));
    }
  }

  function rejectAction(action: AssistantAction) {
    setPendingActions((current) => current.filter((item) => item !== action));
    setStatus("No change applied.");
    recordActivity("Declined", actionSummary(action));
  }

  function recordActivity(title: string, detail: string) {
    setActivity((current) => [
      {
        id: nextLocalId("activity"),
        title,
        detail,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 8));
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Open Chéng zǐ"
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(244,126,22,0.28)] bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-soft)] lg:bottom-5"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Sparkles size={20} />
      </button>

      <aside
        className={`fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-[25rem] flex-col border-l border-[var(--line)] bg-[rgba(255,253,248,0.96)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Chéng zǐ assistant"
      >
        <header className="border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(244,126,22,0.13)] text-[var(--accent)]">
                <Bot size={20} />
              </span>
              <div>
                <p className="font-semibold">Chéng zǐ</p>
                <p className="text-xs text-[var(--muted)]">Orange OS assistant</p>
              </div>
            </div>
            <button
              aria-label="Close assistant"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-strong)]"
              onClick={() => setOpen(false)}
              type="button"
            >
              <Minus size={18} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Provider
              <select
                className="os-input h-9 rounded-xl px-2 text-sm normal-case tracking-normal"
                value={provider}
                onChange={(event) => void savePreferences({ provider: event.target.value as AssistantProvider })}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Claude</option>
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Model
              <select
                className="os-input h-9 rounded-xl px-2 text-sm normal-case tracking-normal"
                value={mode}
                onChange={(event) => void savePreferences({ mode: event.target.value as AssistantModelMode })}
              >
                <option value="cost">Cost</option>
                <option value="balanced">Balanced</option>
                <option value="power">Power</option>
              </select>
            </label>
            <button
              aria-pressed={developerMode}
              className={`mt-5 flex h-9 w-9 items-center justify-center rounded-xl border ${
                developerMode
                  ? "border-[rgba(244,126,22,0.34)] bg-[rgba(244,126,22,0.13)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
              onClick={() => void savePreferences({ developerMode: !developerMode })}
              title="Developer mode"
              type="button"
            >
              <Code2 size={16} />
            </button>
          </div>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-auto bg-[var(--accent)] text-white"
                    : "mr-auto border border-[var(--line)] bg-white/72 text-[var(--foreground)]"
                }`}
                key={message.id}
              >
                {message.content}
              </article>
            ))}

            {pendingActions.map((action, index) => (
              <div className="rounded-2xl border border-[rgba(244,126,22,0.24)] bg-[rgba(255,244,230,0.78)] p-3" key={`${action.type}-${index}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Settings2 size={15} />
                  Confirmation needed
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{actionSummary(action)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="os-primary-button inline-flex h-9 items-center gap-2 px-3 text-sm font-semibold"
                    onClick={() => void applyAction(action)}
                    type="button"
                  >
                    <Check size={15} />
                    {actionLabel(action)}
                  </button>
                  <button
                    className="os-secondary-button inline-flex h-9 items-center gap-2 px-3 text-sm font-semibold"
                    onClick={() => rejectAction(action)}
                    type="button"
                  >
                    <X size={15} />
                    No
                  </button>
                </div>
              </div>
            ))}

            {activity.length ? (
              <section className="rounded-2xl border border-[var(--line)] bg-white/62 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <MessageSquareText size={15} />
                  Activity
                </div>
                <div className="mt-2 grid gap-2">
                  {activity.slice(0, 4).map((item) => (
                    <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <time className="shrink-0 text-[11px] text-[var(--muted-soft)]">
                          {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt))}
                        </time>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {loading ? (
              <div className="mr-auto inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/72 px-3 py-2 text-sm text-[var(--muted)]">
                <Loader2 size={15} className="animate-spin" />
                Thinking
              </div>
            ) : null}
          </div>
        </div>

        <footer className="border-t border-[var(--line)] p-3">
          {status ? (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-[var(--panel-strong)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
              <MessageSquareText size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              {status}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              className="os-input min-h-11 flex-1 resize-none rounded-2xl px-3 py-2 text-sm leading-6"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask Chéng zǐ..."
              rows={1}
              value={input}
            />
            <button
              aria-label="Send"
              className="os-primary-button flex h-11 w-11 shrink-0 items-center justify-center"
              disabled={loading}
              onClick={() => void sendMessage()}
              type="button"
            >
              {loading ? <RotateCcw size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
