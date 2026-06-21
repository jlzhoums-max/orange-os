import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getGoogleAccessToken, googleErrorPayload, googleFetch } from "@/lib/google/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ messageId: string }>;
};

type EmailAction = "archive" | "trash" | "queueReply";

type GmailMessageResponse = {
  id: string;
  labelIds?: string[];
};

type GmailDraftResponse = {
  id: string;
  message?: {
    id?: string;
  };
};

type SyncedEmailRecord = {
  id: string;
  gmail_message_id: string;
  thread_id: string | null;
  sender: string | null;
  subject: string | null;
  labels: string[];
};

function removeLabels(labels: string[], removals: string[]) {
  const removeSet = new Set(removals);
  return labels.filter((label) => !removeSet.has(label));
}

function senderEmail(sender: string | null) {
  if (!sender) return null;
  return sender.match(/<(.+?)>/)?.[1] ?? sender;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildReplyDraft(record: SyncedEmailRecord, draft: string) {
  const to = senderEmail(record.sender);
  if (!to) {
    throw new Error("This message is missing a reply address.");
  }

  const subject = record.subject?.trim() || "(No subject)";
  const replySubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;

  return encodeBase64Url(
    [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      "Content-Type: text/plain; charset=\"UTF-8\"",
      "",
      draft.trim(),
    ].join("\r\n"),
  );
}

async function createGmailDraft(userId: string, raw: string) {
  const token = await getGoogleAccessToken(userId);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail draft failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  return (await response.json()) as GmailDraftResponse;
}

async function archiveGmailMessage(userId: string, messageId: string) {
  return googleFetch<GmailMessageResponse>(
    userId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["INBOX", "UNREAD"] }),
    },
  );
}

async function trashGmailMessage(userId: string, messageId: string) {
  return googleFetch<GmailMessageResponse>(
    userId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: "POST",
    },
  );
}

export async function PATCH(request: Request, { params }: Params) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { messageId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: EmailAction; draft?: string };
  const action = body.action;

  if (action !== "archive" && action !== "trash" && action !== "queueReply") {
    return NextResponse.json({ error: "Unsupported email action" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: record, error } = await admin
    .from("synced_emails")
    .select("id, gmail_message_id, thread_id, sender, subject, labels")
    .eq("user_id", user.id)
    .eq("gmail_message_id", messageId)
    .single();

  if (error || !record) {
    return NextResponse.json({ error: "Email message was not found for this user." }, { status: 404 });
  }

  const syncedRecord = record as SyncedEmailRecord;
  let draftId: string | null = null;
  let nextLabels = syncedRecord.labels ?? [];

  try {
    if (action === "queueReply") {
      const draft = body.draft?.trim();
      if (!draft) {
        return NextResponse.json({ error: "Draft text is required before queueing a reply." }, { status: 400 });
      }

      const createdDraft = await createGmailDraft(user.id, buildReplyDraft(syncedRecord, draft));
      draftId = createdDraft.id;
      const archived = await archiveGmailMessage(user.id, messageId);
      nextLabels = archived.labelIds ?? removeLabels(nextLabels, ["INBOX", "UNREAD"]);
    }

    if (action === "archive") {
      const archived = await archiveGmailMessage(user.id, messageId);
      nextLabels = archived.labelIds ?? removeLabels(nextLabels, ["INBOX", "UNREAD"]);
    }

    if (action === "trash") {
      const trashed = await trashGmailMessage(user.id, messageId);
      nextLabels = trashed.labelIds ?? ["TRASH", ...removeLabels(nextLabels, ["INBOX", "UNREAD", "TRASH"])];
    }
  } catch (actionError) {
    const payload = googleErrorPayload(actionError);
    return NextResponse.json(payload.body, { status: payload.status });
  }

  const { error: updateError } = await admin
    .from("synced_emails")
    .update({
      labels: nextLabels,
    })
    .eq("id", syncedRecord.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action, draftId, labels: nextLabels });
}
