import { googleFetch } from "@/lib/google/server";

export type GmailHeader = {
  name: string;
  value: string;
};

export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
    size?: number;
  };
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
};

export type GmailMessageDetail = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type GmailDraftCreateResponse = {
  id: string;
  message?: {
    id: string;
    threadId: string;
    labelIds?: string[];
  };
};

type GmailLabel = {
  id: string;
  name: string;
  type?: string;
};

type GmailLabelsResponse = {
  labels?: GmailLabel[];
};

type GmailModifyResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
};

export type GmailDraftSendResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
};

export function gmailHeader(headers: GmailHeader[] | undefined, name: string) {
  return (
    headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ??
    null
  );
}

export function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return Buffer.from(padded, "base64").toString("utf8");
}

function collectTextParts(part: GmailMessagePart | undefined, mimeType: string): string[] {
  if (!part) {
    return [];
  }

  const current =
    part.mimeType === mimeType && part.body?.data ? [decodeBase64Url(part.body.data)] : [];

  return [
    ...current,
    ...(part.parts ?? []).flatMap((child) => collectTextParts(child, mimeType)),
  ];
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractGmailText(message: GmailMessageDetail) {
  const plain = collectTextParts(message.payload, "text/plain").join("\n\n").trim();

  if (plain) {
    return plain;
  }

  const html = collectTextParts(message.payload, "text/html").join("\n\n").trim();

  if (html) {
    return stripHtml(html);
  }

  return message.snippet ?? "";
}

export function extractEmailAddress(value: string | null) {
  if (!value) {
    return "";
  }

  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

export function ensureReplySubject(subject: string | null) {
  const safeSubject = subject?.trim() || "No subject";
  return /^re:/i.test(safeSubject) ? safeSubject : `Re: ${safeSubject}`;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createReplyRawMessage({
  body,
  from,
  messageId,
  references,
  subject,
  to,
}: {
  body: string;
  from?: string | null;
  messageId?: string | null;
  references?: string | null;
  subject: string | null;
  to: string;
}) {
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : null,
    `Subject: ${ensureReplySubject(subject)}`,
    messageId ? `In-Reply-To: ${messageId}` : null,
    messageId ? `References: ${[references, messageId].filter(Boolean).join(" ")}` : null,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ].filter(Boolean);

  return encodeBase64Url(`${headers.join("\r\n")}\r\n\r\n${body.trim()}\r\n`);
}

export async function getGmailMessageDetail(userId: string, messageId: string, connectedAccountId?: string | null) {
  return googleFetch<GmailMessageDetail>(
    userId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId,
    )}?format=full`,
    undefined,
    connectedAccountId,
  );
}

export async function createGmailReplyDraft({
  body,
  userEmail,
  userId,
  original,
  connectedAccountId,
}: {
  body: string;
  connectedAccountId?: string | null;
  userEmail?: string | null;
  userId: string;
  original: GmailMessageDetail;
}) {
  const headers = original.payload?.headers ?? [];
  const raw = createReplyRawMessage({
    body,
    from: userEmail,
    messageId: gmailHeader(headers, "Message-ID"),
    references: gmailHeader(headers, "References"),
    subject: gmailHeader(headers, "Subject"),
    to: extractEmailAddress(gmailHeader(headers, "Reply-To") ?? gmailHeader(headers, "From")),
  });

  return googleFetch<GmailDraftCreateResponse>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          raw,
          threadId: original.threadId,
        },
      }),
    },
    connectedAccountId,
  );
}

export async function ensureGmailLabel(userId: string, name: string, connectedAccountId?: string | null) {
  const labels = await googleFetch<GmailLabelsResponse>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    undefined,
    connectedAccountId,
  );
  const existing = labels.labels?.find((label) => label.name === name);

  if (existing?.id) {
    return existing.id;
  }

  const created = await googleFetch<GmailLabel>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        name,
      }),
    },
    connectedAccountId,
  );

  return created.id;
}

export async function modifyGmailMessage({
  addLabelIds = [],
  messageId,
  removeLabelIds = [],
  userId,
  connectedAccountId,
}: {
  addLabelIds?: string[];
  connectedAccountId?: string | null;
  messageId: string;
  removeLabelIds?: string[];
  userId: string;
}) {
  return googleFetch<GmailModifyResponse>(
    userId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId,
    )}/modify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    },
    connectedAccountId,
  );
}

export async function sendGmailDraft(userId: string, draftId: string, connectedAccountId?: string | null) {
  return googleFetch<GmailDraftSendResponse>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: draftId }),
    },
    connectedAccountId,
  );
}
