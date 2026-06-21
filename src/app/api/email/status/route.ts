import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
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
  const [runsResult, emailsResult] = await Promise.all([
    admin
      .from("sync_runs")
      .select("trigger, status, gmail_count, calendar_count, market_count, error, started_at, completed_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5),
    admin
      .from("synced_emails")
      .select("labels, raw")
      .eq("user_id", user.id)
      .limit(200),
  ]);

  if (runsResult.error || emailsResult.error) {
    return NextResponse.json(
      { error: runsResult.error?.message ?? emailsResult.error?.message ?? "Email status could not be loaded." },
      { status: 500 },
    );
  }

  const now = Date.now();
  const emails = emailsResult.data ?? [];

  return NextResponse.json({
    recentRuns: runsResult.data ?? [],
    dueFollowUps: emails.filter((email) => {
      const reminderAt = rawRecord(email.raw).orangeReminderAt;
      return typeof reminderAt === "string" && new Date(reminderAt).getTime() <= now;
    }).length,
    scheduledFollowUps: emails.filter((email) => typeof rawRecord(email.raw).orangeReminderAt === "string").length,
    snoozed: emails.filter((email) => email.labels?.includes("OrangeOS/Snoozed")).length,
    dueSnoozed: emails.filter((email) => {
      const snoozeUntil = rawRecord(email.raw).orangeSnoozeUntil;
      return typeof snoozeUntil === "string" && new Date(snoozeUntil).getTime() <= now;
    }).length,
  });
}
