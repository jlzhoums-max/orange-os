import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ensureGmailLabel, modifyGmailMessage } from "@/lib/google/gmail";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type EmailCategory = "Important" | "Needs Reply" | "Read Later" | "News" | "Tools";

const categoryLabels: Record<EmailCategory, string> = {
  Important: "OrangeOS/Important",
  "Needs Reply": "OrangeOS/Needs Reply",
  "Read Later": "OrangeOS/Read Later",
  News: "OrangeOS/News",
  Tools: "OrangeOS/Tools",
};

const separatorSchema = z.object({
  decisions: z.array(
    z.object({
      messageId: z.string(),
      category: z.enum(["Important", "Needs Reply", "Read Later", "News", "Tools"]),
      reason: z.string(),
    }),
  ),
});

type SyncedEmailForSeparation = {
  connected_account_id: string | null;
  gmail_message_id: string;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  labels: string[];
  raw: Json;
};

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

function ruleCategory(email: SyncedEmailForSeparation): EmailCategory {
  const haystack = [
    email.sender,
    email.subject,
    email.snippet,
    ...email.labels,
  ].join(" ").toLowerCase();

  if (email.labels.includes("IMPORTANT") || /urgent|action required|deadline|invoice overdue/.test(haystack)) {
    return "Important";
  }

  if (/reply|respond|question|confirm|approval|can you|could you|please review/.test(haystack)) {
    return "Needs Reply";
  }

  if (/newsletter|digest|brief|roundup|news/.test(haystack)) {
    return "News";
  }

  if (/stripe|github|vercel|notion|google|supabase|openai|receipt|security alert/.test(haystack)) {
    return "Tools";
  }

  return "Read Later";
}

async function aiDecisions(emails: SyncedEmailForSeparation[]) {
  if (!process.env.OPENAI_API_KEY || !emails.length) {
    return null;
  }

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL || "gpt-5.5"),
    output: Output.object({ schema: separatorSchema }),
    system:
      "Classify email inbox items for a personal operating system. Do not draft replies. Choose exactly one category for each message: Important for urgent/high-value/decision items, Needs Reply for messages likely requiring a response, Read Later for nonurgent human mail, News for newsletters/digests/media, Tools for automated product/billing/security/tool notifications.",
    prompt: JSON.stringify({
      emails: emails.map((email) => ({
        messageId: email.gmail_message_id,
        sender: email.sender,
        subject: email.subject,
        snippet: email.snippet,
        labels: email.labels,
      })),
    }),
  });

  return new Map(output.decisions.map((decision) => [decision.messageId, decision]));
}

export async function separateEmailsForUser(userId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("synced_emails")
    .select("connected_account_id, gmail_message_id, sender, subject, snippet, labels, raw")
    .eq("user_id", userId)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const emails = (data ?? []) as SyncedEmailForSeparation[];
  const decisions = await aiDecisions(emails);
  const labelIds = new Map<string, string>();

  const results = await Promise.allSettled(
    emails.map(async (email) => {
      const aiDecision = decisions?.get(email.gmail_message_id);
      const category = aiDecision?.category ?? ruleCategory(email);
      const reason = aiDecision?.reason ?? "Classified by Orange OS separator rules.";
      const labelName = categoryLabels[category];
      const labelKey = `${email.connected_account_id ?? "primary"}:${category}`;
      let labelId = labelIds.get(labelKey);
      if (!labelId) {
        labelId = await ensureGmailLabel(userId, labelName, email.connected_account_id);
        labelIds.set(labelKey, labelId);
      }
      const labels = Array.from(new Set([...(email.labels ?? []), labelName]));

      if (labelId) {
        await modifyGmailMessage({
          addLabelIds: [labelId],
          connectedAccountId: email.connected_account_id,
          messageId: email.gmail_message_id,
          userId,
        });
      }

      let updateQuery = admin
        .from("synced_emails")
        .update({
          labels,
          raw: {
            ...rawRecord(email.raw),
            orangeCategory: category,
            orangeReason: reason,
            orangeSeparatedAt: new Date().toISOString(),
          },
        })
        .eq("user_id", userId)
        .eq("gmail_message_id", email.gmail_message_id);
      if (email.connected_account_id) {
        updateQuery = updateQuery.eq("connected_account_id", email.connected_account_id);
      }
      await updateQuery;

      return { category, messageId: email.gmail_message_id };
    }),
  );

  return {
    categorized: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

export function labelForCategory(category: EmailCategory) {
  return categoryLabels[category];
}
