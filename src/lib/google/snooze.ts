import { ensureGmailLabel, modifyGmailMessage } from "@/lib/google/gmail";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type SnoozedEmailRow = {
  connected_account_id: string | null;
  gmail_message_id: string;
  labels: string[] | null;
  raw: Json;
};

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

export async function restoreDueSnoozedEmailsForUser(userId: string, now = new Date()) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("synced_emails")
    .select("connected_account_id, gmail_message_id, labels, raw")
    .eq("user_id", userId)
    .contains("labels", ["OrangeOS/Snoozed"])
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const dueRows = ((data ?? []) as SnoozedEmailRow[]).filter((email) => {
    const snoozeUntil = rawRecord(email.raw).orangeSnoozeUntil;
    return typeof snoozeUntil === "string" && new Date(snoozeUntil).getTime() <= now.getTime();
  });

  if (!dueRows.length) {
    return 0;
  }

  await Promise.all(
    dueRows.map(async (email) => {
      const snoozedLabelId = await ensureGmailLabel(userId, "OrangeOS/Snoozed", email.connected_account_id);
      await modifyGmailMessage({
        addLabelIds: ["INBOX"],
        connectedAccountId: email.connected_account_id,
        messageId: email.gmail_message_id,
        removeLabelIds: [snoozedLabelId],
        userId,
      });

      const raw = rawRecord(email.raw);
      let updateQuery = admin
        .from("synced_emails")
        .update({
          labels: (email.labels ?? []).filter((label) => label !== "OrangeOS/Snoozed"),
          raw: {
            ...raw,
            orangeCategory: "Read Later",
            orangeReason: "Restored automatically after snooze expired.",
            orangeRestoredAt: now.toISOString(),
            orangeSnoozedAt: null,
            orangeSnoozeUntil: null,
          },
        })
        .eq("user_id", userId)
        .eq("gmail_message_id", email.gmail_message_id);
      if (email.connected_account_id) {
        updateQuery = updateQuery.eq("connected_account_id", email.connected_account_id);
      }
      await updateQuery;
    }),
  );

  return dueRows.length;
}
