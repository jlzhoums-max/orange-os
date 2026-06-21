export type AssistantProvider = "openai" | "anthropic";
export type AssistantModelMode = "cost" | "balanced" | "power";

export type DashboardModuleId =
  | "hero"
  | "quick_capture"
  | "focus"
  | "inbox"
  | "calendar"
  | "market"
  | "ai_brief"
  | "data_connections";

export type DashboardLayoutItem = {
  id: DashboardModuleId;
  visible: boolean;
};

export type AssistantAction =
  | {
      type: "update_layout";
      surface: "home";
      modules: DashboardLayoutItem[];
      summary: string;
    }
  | {
      type: "remember_preference";
      key: string;
      value: string;
      summary: string;
    }
  | {
      type: "create_task";
      title: string;
      reason: string;
      summary: string;
    }
  | {
      type: "create_ledger_expense";
      label: string;
      amount: number;
      bucket: "needs" | "wants" | "savings";
      date: string;
      tags: string[];
      notes: string;
      summary: string;
    }
  | {
      type: "create_email_draft";
      messageId: string;
      body: string;
      summary: string;
    }
  | {
      type: "email_message_action";
      messageId: string;
      action: "archive" | "unarchive" | "markRead" | "markUnread" | "label" | "snooze" | "unsnooze";
      label?: "OrangeOS/Important" | "OrangeOS/Needs Reply" | "OrangeOS/Read Later" | "OrangeOS/News" | "OrangeOS/Tools";
      summary: string;
    }
  | {
      type: "create_calendar_event";
      title: string;
      startsAt: string;
      endsAt: string;
      location: string;
      description: string;
      attendees: string[];
      summary: string;
    }
  | {
      type: "developer_request";
      request: string;
      summary: string;
    };

export type AssistantModule = {
  id: DashboardModuleId;
  label: string;
  surface: "home";
  description: string;
  canHide: boolean;
};

export const homeModules: AssistantModule[] = [
  {
    id: "hero",
    label: "Command Center",
    surface: "home",
    description: "Greeting, live refresh status, sync controls, and the main Brief button.",
    canHide: false,
  },
  {
    id: "quick_capture",
    label: "Quick Capture",
    surface: "home",
    description: "Fast entry area for capturing notes, reminders, and lightweight tasks.",
    canHide: true,
  },
  {
    id: "focus",
    label: "Focus Items",
    surface: "home",
    description: "Three compact AI or default priority chips below the command center.",
    canHide: true,
  },
  {
    id: "inbox",
    label: "Priority Inbox",
    surface: "home",
    description: "Recent Gmail items with urgency labels and snippets.",
    canHide: true,
  },
  {
    id: "calendar",
    label: "Calendar Runway",
    surface: "home",
    description: "Upcoming Google Calendar events and timing context.",
    canHide: true,
  },
  {
    id: "market",
    label: "Market Watch",
    surface: "home",
    description: "Tracked market quotes for SPY, QQQ, and VNQ.",
    canHide: true,
  },
  {
    id: "ai_brief",
    label: "AI Brief",
    surface: "home",
    description: "Saved generated recommendation, tasks, reply drafts, and project updates.",
    canHide: true,
  },
  {
    id: "data_connections",
    label: "Data Connections",
    surface: "home",
    description: "Connection status for Gmail, Calendar, market data, and project memory.",
    canHide: true,
  },
];

export const defaultHomeLayout: DashboardLayoutItem[] = homeModules.map((module) => ({
  id: module.id,
  visible: true,
}));

export function normalizeHomeLayout(value: unknown): DashboardLayoutItem[] {
  const moduleIds = new Set(homeModules.map((module) => module.id));
  const byId = new Map<DashboardModuleId, DashboardLayoutItem>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const id = (item as { id?: unknown }).id;
      if (typeof id === "string" && moduleIds.has(id as DashboardModuleId)) {
        const moduleDefinition = homeModules.find((candidate) => candidate.id === id);
        byId.set(id as DashboardModuleId, {
          id: id as DashboardModuleId,
          visible: moduleDefinition?.canHide === false ? true : (item as { visible?: unknown }).visible !== false,
        });
      }
    }
  }

  for (const item of defaultHomeLayout) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values());
}

export function assistantModelLabel(provider: AssistantProvider, mode: AssistantModelMode) {
  if (provider === "anthropic") {
    if (mode === "power") {
      return process.env.ANTHROPIC_POWER_MODEL || "claude-sonnet-4-5";
    }

    if (mode === "balanced") {
      return process.env.ANTHROPIC_BALANCED_MODEL || "claude-sonnet-4-5";
    }

    return process.env.ANTHROPIC_COST_MODEL || "claude-haiku-4-5";
  }

  if (mode === "power") {
    return process.env.OPENAI_POWER_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";
  }

  if (mode === "balanced") {
    return process.env.OPENAI_BALANCED_MODEL || "gpt-5.4";
  }

  return process.env.OPENAI_COST_MODEL || "gpt-5.4-mini";
}
