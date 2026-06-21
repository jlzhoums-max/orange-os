import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncWorkspaceForUser } from "@/lib/google/sync";

const centralSyncHours = new Set([7, 12, 17, 21]);

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

  return NextResponse.json({
    syncedUsers: results.filter((result) => result.status === "fulfilled").length,
    failedUsers: results.filter((result) => result.status === "rejected").length,
    centralHour: hour,
  });
}
