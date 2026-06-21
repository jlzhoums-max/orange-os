import { NextResponse } from "next/server";
import { runDailyReflectionForUser } from "@/lib/assistant/reflection";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { separateEmailsForUser } from "@/lib/google/separator";
import { restoreDueSnoozedEmailsForUser } from "@/lib/google/snooze";
import { syncWorkspaceForUser } from "@/lib/google/sync";

const centralSyncHours = new Set([0, 1, 7, 12, 17, 21]);
const centralReflectionHours = new Set([0, 1]);

function centralHour(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Chicago",
  }).formatToParts(date);

  return Number(parts.find((part) => part.type === "hour")?.value ?? -1);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const hour = centralHour(now);
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (!force && !centralSyncHours.has(hour)) {
    return NextResponse.json({ skipped: true, centralHour: hour });
  }

  const admin = getSupabaseAdmin();
  const { data: accounts, error } = await admin
    .from("connected_accounts")
    .select("user_id")
    .eq("provider", "google")
    .not("refresh_token", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((accounts ?? []).map((account) => account.user_id)));
  const results = await Promise.allSettled(
    userIds.map((userId) => syncWorkspaceForUser(userId, force ? "cron-force" : "cron")),
  );
  const shouldSeparate = force || hour === 7 || centralReflectionHours.has(hour);
  const separatorResults = shouldSeparate
    ? await Promise.allSettled(userIds.map((userId) => separateEmailsForUser(userId)))
    : [];
  const restoredResults = await Promise.allSettled(userIds.map((userId) => restoreDueSnoozedEmailsForUser(userId, now)));
  const shouldReflect = force || centralReflectionHours.has(hour);
  const reflectionResults = shouldReflect
    ? await Promise.allSettled(userIds.map((userId) => runDailyReflectionForUser(userId, { force })))
    : [];

  return NextResponse.json({
    syncedUsers: results.filter((result) => result.status === "fulfilled").length,
    failedUsers: results.filter((result) => result.status === "rejected").length,
    separatedUsers: separatorResults.filter((result) => result.status === "fulfilled").length,
    failedSeparations: separatorResults.filter((result) => result.status === "rejected").length,
    reflectedUsers: reflectionResults.filter((result) => result.status === "fulfilled" && result.value.created).length,
    skippedReflections: reflectionResults.filter((result) => result.status === "fulfilled" && !result.value.created).length,
    failedReflections: reflectionResults.filter((result) => result.status === "rejected").length,
    restoredSnoozed: restoredResults.reduce(
      (total, result) => total + (result.status === "fulfilled" ? result.value : 0),
      0,
    ),
    failedSnoozeRestores: restoredResults.filter((result) => result.status === "rejected").length,
    centralHour: hour,
  });
}
