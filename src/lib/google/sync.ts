import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { googleFetch } from "@/lib/google/server";
import { fetchMarketQuotes } from "@/lib/market/quotes";
import type { Json } from "@/lib/database.types";

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

type CalendarEventsResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: unknown[];
  }>;
};

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? null
  );
}

export async function syncGmailForUser(userId: string) {
  const list = await googleFetch<GmailListResponse>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in:inbox newer_than:14d",
  );

  const messages = await Promise.all(
    (list.messages ?? []).map((message) =>
      googleFetch<GmailMessage>(
        userId,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      ),
    ),
  );

  if (messages.length > 0) {
    const admin = getSupabaseAdmin();
    await admin.from("synced_emails").upsert(
      messages.map((message) => ({
        user_id: userId,
        gmail_message_id: message.id,
        thread_id: message.threadId,
        sender: header(message, "From"),
        subject: header(message, "Subject"),
        snippet: message.snippet ?? null,
        received_at: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : null,
        labels: message.labelIds ?? [],
        raw: message as Json,
      })),
      { onConflict: "user_id,gmail_message_id" },
    );
  }

  return messages.length;
}

export async function syncCalendarForUser(userId: string) {
  const timeMin = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "25");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);

  const events = await googleFetch<CalendarEventsResponse>(userId, url.toString());

  if (events.items?.length) {
    const admin = getSupabaseAdmin();
    await admin.from("synced_calendar_events").upsert(
      events.items.map((event) => ({
        user_id: userId,
        google_event_id: event.id,
        calendar_id: "primary",
        title: event.summary ?? null,
        starts_at: event.start?.dateTime ?? event.start?.date ?? null,
        ends_at: event.end?.dateTime ?? event.end?.date ?? null,
        location: event.location ?? null,
        attendees: (event.attendees ?? []) as Json,
        raw: event as Json,
      })),
      { onConflict: "user_id,calendar_id,google_event_id" },
    );
  }

  return events.items?.length ?? 0;
}

export async function syncMarketQuotesForUser(symbols = ["SPY", "QQQ", "VNQ"]) {
  const quotes = await fetchMarketQuotes(symbols);
  const admin = getSupabaseAdmin();

  await admin.from("market_quotes").insert(
    quotes.map((quote) => ({
      symbol: quote.symbol,
      price: quote.price,
      change_percent: quote.changePercent,
      provider: quote.provider,
      raw: quote.raw,
    })),
  );

  return quotes.length;
}

export async function syncWorkspaceForUser(userId: string, trigger: string) {
  const admin = getSupabaseAdmin();
  const { data: run } = await admin
    .from("sync_runs")
    .insert({ user_id: userId, trigger, status: "started" })
    .select("id")
    .single();

  try {
    const [gmailCount, calendarCount, marketCount] = await Promise.all([
      syncGmailForUser(userId),
      syncCalendarForUser(userId),
      syncMarketQuotesForUser(),
    ]);

    if (run?.id) {
      await admin
        .from("sync_runs")
        .update({
          status: "completed",
          gmail_count: gmailCount,
          calendar_count: calendarCount,
          market_count: marketCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    return { gmailCount, calendarCount, marketCount };
  } catch (error) {
    if (run?.id) {
      await admin
        .from("sync_runs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown sync error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    throw error;
  }
}
