import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
  const userId = user.id;

  const [emailsResult, eventsResult, quotesResult] = await Promise.all([
    admin
      .from("synced_emails")
      .select("sender, subject, snippet, received_at, labels, created_at")
      .eq("user_id", userId)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(8),
    admin
      .from("synced_calendar_events")
      .select("title, starts_at, ends_at, location, attendees, created_at")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(8),
    admin
      .from("market_quotes")
      .select("symbol, price, change_percent, provider, fetched_at")
      .in("symbol", ["SPY", "QQQ", "VNQ"])
      .order("fetched_at", { ascending: false })
      .limit(12),
  ]);

  if (emailsResult.error || eventsResult.error || quotesResult.error) {
    return NextResponse.json(
      {
        error: emailsResult.error?.message ?? eventsResult.error?.message ?? quotesResult.error?.message,
      },
      { status: 500 },
    );
  }

  const latestQuotes = new Map<string, (typeof quotesResult.data)[number]>();
  for (const quote of quotesResult.data ?? []) {
    if (!latestQuotes.has(quote.symbol)) {
      latestQuotes.set(quote.symbol, quote);
    }
  }

  return NextResponse.json({
    emails: emailsResult.data ?? [],
    events: eventsResult.data ?? [],
    quotes: Array.from(latestQuotes.values()),
    refreshedAt: new Date().toISOString(),
  });
}
