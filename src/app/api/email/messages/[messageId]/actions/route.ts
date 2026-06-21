import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { ensureGmailLabel, modifyGmailMessage } from "@/lib/google/gmail";
import { getConnectedAccountIdForMessage } from "@/lib/google/message-account";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const actionSchema = z.object({
  action: z.enum(["archive", "unarchive", "markRead", "markUnread", "label", "snooze", "unsnooze"]),
  label: z.enum(["OrangeOS/Important", "OrangeOS/Needs Reply", "OrangeOS/Read Later", "OrangeOS/News", "OrangeOS/Tools"]).optional(),
  snoozeUntil: z.string().datetime().nullable().optional(),
});

function gmailModifyBody(action: z.infer<typeof actionSchema>["action"], labelId?: string) {
  if (action === "archive") {
    return {
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    };
  }

  if (action === "unarchive") {
    return {
      addLabelIds: ["INBOX"],
      removeLabelIds: [],
    };
  }

  if (action === "markRead") {
    return {
      addLabelIds: [],
      removeLabelIds: ["UNREAD"],
    };
  }

  if (action === "label") {
    return {
      addLabelIds: labelId ? [labelId] : [],
      removeLabelIds: [],
    };
  }

  if (action === "snooze") {
    return {
      addLabelIds: labelId ? [labelId] : [],
      removeLabelIds: ["INBOX"],
    };
  }

  if (action === "unsnooze") {
    return {
      addLabelIds: ["INBOX"],
      removeLabelIds: labelId ? [labelId] : [],
    };
  }

  return {
    addLabelIds: ["UNREAD"],
    removeLabelIds: [],
  };
}

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

function categoryFromLabel(label?: string | null) {
  if (!label) {
    return null;
  }

  return label.replace("OrangeOS/", "");
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported email action." }, { status: 400 });
  }

  const { messageId } = await context.params;
  const connectedAccountId = await getConnectedAccountIdForMessage(user.id, messageId);
  const labelName = parsed.data.action === "snooze" || parsed.data.action === "unsnooze" ? "OrangeOS/Snoozed" : parsed.data.label;
  const labelId = labelName ? await ensureGmailLabel(user.id, labelName, connectedAccountId) : undefined;
  const body = gmailModifyBody(parsed.data.action, labelId);
  const modified = await modifyGmailMessage({
    addLabelIds: body.addLabelIds,
    connectedAccountId,
    messageId,
    removeLabelIds: body.removeLabelIds,
    userId: user.id,
  });

  const admin = getSupabaseAdmin();

  if (parsed.data.action === "archive") {
    let query = admin
      .from("synced_emails")
      .delete()
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      query = query.eq("connected_account_id", connectedAccountId);
    }
    await query;
  } else if (parsed.data.action === "snooze" || parsed.data.action === "unsnooze") {
    let existingQuery = admin
      .from("synced_emails")
      .select("labels, raw")
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      existingQuery = existingQuery.eq("connected_account_id", connectedAccountId);
    }
    const { data: existing } = await existingQuery.maybeSingle();
    const existingLabels: string[] = existing?.labels ?? [];
    const labels =
      parsed.data.action === "snooze"
        ? Array.from(new Set([...existingLabels, "OrangeOS/Snoozed"]))
        : existingLabels.filter((label) => label !== "OrangeOS/Snoozed");
    const raw = rawRecord(existing?.raw ?? {});

    let updateQuery = admin
      .from("synced_emails")
      .update({
        labels,
        raw: {
          ...raw,
          orangeCategory: parsed.data.action === "snooze" ? "Snoozed" : "Read Later",
          orangeReason:
            parsed.data.action === "snooze"
              ? "Snoozed manually in Orange OS Mail."
              : "Returned to Inbox manually in Orange OS Mail.",
          orangeSeparatedAt: new Date().toISOString(),
          orangeSnoozedAt: parsed.data.action === "snooze" ? new Date().toISOString() : null,
          orangeSnoozeUntil: parsed.data.action === "snooze" ? parsed.data.snoozeUntil ?? null : null,
        },
      })
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      updateQuery = updateQuery.eq("connected_account_id", connectedAccountId);
    }
    await updateQuery;
  } else if (parsed.data.action === "label") {
    let existingQuery = admin
      .from("synced_emails")
      .select("labels, raw")
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      existingQuery = existingQuery.eq("connected_account_id", connectedAccountId);
    }
    const { data: existing } = await existingQuery.maybeSingle();
    const labels = Array.from(new Set([...(existing?.labels ?? []), parsed.data.label].filter(Boolean))) as string[];

    let updateQuery = admin
      .from("synced_emails")
      .update({
        labels,
        raw: {
          ...rawRecord(existing?.raw ?? {}),
          orangeCategory: categoryFromLabel(parsed.data.label),
          orangeReason: "Set manually in Orange OS Mail.",
          orangeSeparatedAt: new Date().toISOString(),
        },
      })
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      updateQuery = updateQuery.eq("connected_account_id", connectedAccountId);
    }
    await updateQuery;
  } else {
    let updateQuery = admin
      .from("synced_emails")
      .update({
        labels: modified.labelIds ?? [],
      })
      .eq("user_id", user.id)
      .eq("gmail_message_id", messageId);
    if (connectedAccountId) {
      updateQuery = updateQuery.eq("connected_account_id", connectedAccountId);
    }
    await updateQuery;
  }

  return NextResponse.json({
    action: parsed.data.action,
    labels: modified.labelIds ?? [],
    messageId: modified.id,
    threadId: modified.threadId,
  });
}
