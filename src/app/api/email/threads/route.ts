import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { syncGmailForUser } from "@/lib/google/sync";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type OrangeCategory = "Important" | "Needs Reply" | "Read Later" | "News" | "Tools" | "Snoozed";

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, Json>) : {};
}

function formatSender(value: string | null) {
  if (!value) {
    return "Unknown sender";
  }

  return value.replace(/\s*<[^>]+>/, "").replace(/^"|"$/g, "").trim() || value;
}

function splitForEmail(labels: string[], sender: string | null, subject: string | null, raw: Json) {
  const orangeCategory = rawRecord(raw).orangeCategory;
  if (
    orangeCategory === "Important" ||
    orangeCategory === "Needs Reply" ||
    orangeCategory === "Read Later" ||
    orangeCategory === "News" ||
    orangeCategory === "Tools" ||
    orangeCategory === "Snoozed"
  ) {
    return orangeCategory as OrangeCategory;
  }

  const normalized = `${sender ?? ""} ${subject ?? ""}`.toLowerCase();

  if (labels.includes("IMPORTANT") || labels.includes("OrangeOS/Important")) {
    return "Important";
  }

  if (labels.includes("OrangeOS/Needs Reply")) {
    return "Needs Reply";
  }

  if (labels.includes("OrangeOS/Read Later")) {
    return "Read Later";
  }

  if (labels.includes("OrangeOS/Snoozed")) {
    return "Snoozed";
  }

  if (labels.includes("OrangeOS/Tools") || normalized.includes("stripe") || normalized.includes("notion") || normalized.includes("github")) {
    return "Tools";
  }

  if (labels.includes("OrangeOS/News") || normalized.includes("newsletter") || normalized.includes("brief") || normalized.includes("news")) {
    return "News";
  }

  return "Read Later";
}

export async function GET() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("synced_emails")
    .select("connected_account_id, gmail_message_id, thread_id, sender, subject, snippet, received_at, labels, raw")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: accounts } = await admin
    .from("connected_accounts")
    .select("id, account_email, display_name, is_primary")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));

  return NextResponse.json({
    accounts: accounts ?? [],
    threads: (data ?? []).map((email) => ({
      id: `${email.connected_account_id ?? "google"}:${email.gmail_message_id}`,
      connectedAccountId: email.connected_account_id,
      accountEmail: email.connected_account_id ? accountById.get(email.connected_account_id)?.account_email ?? null : null,
      accountName: email.connected_account_id ? accountById.get(email.connected_account_id)?.display_name ?? null : null,
      gmailMessageId: email.gmail_message_id,
      threadId: email.thread_id,
      split: splitForEmail(email.labels ?? [], email.sender, email.subject, email.raw),
      from: formatSender(email.sender),
      sender: email.sender,
      subject: email.subject ?? "No subject",
      preview: email.snippet ?? "No preview available.",
      receivedAt: email.received_at,
      labels: email.labels ?? [],
      unread: email.labels?.includes("UNREAD") ?? false,
      important: email.labels?.includes("IMPORTANT") ?? false,
      reminderAt: typeof rawRecord(email.raw).orangeReminderAt === "string" ? rawRecord(email.raw).orangeReminderAt : null,
      snoozeUntil: typeof rawRecord(email.raw).orangeSnoozeUntil === "string" ? rawRecord(email.raw).orangeSnoozeUntil : null,
    })),
    refreshedAt: new Date().toISOString(),
  });
}

export async function POST() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const synced = await syncGmailForUser(user.id);

  return NextResponse.json({ synced, refreshedAt: new Date().toISOString() });
}
