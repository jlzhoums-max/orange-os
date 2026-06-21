import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { googleFetch, listGoogleConnectedAccounts, type GoogleConnectedAccount } from "@/lib/google/server";
import { gmailHeader } from "@/lib/google/gmail";
import {
  canReadCalendar,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  type GoogleCalendarEvent,
  type GoogleCalendarListEntry,
} from "@/lib/google/calendar";
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

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

function eventStart(event: GoogleCalendarEvent) {
  return event.start?.dateTime ?? event.start?.date ?? null;
}

function eventEnd(event: GoogleCalendarEvent) {
  return event.end?.dateTime ?? event.end?.date ?? null;
}

function isAllDayEvent(event: GoogleCalendarEvent) {
  return Boolean(event.start?.date && !event.start.dateTime);
}

function eventTimeZone(event: GoogleCalendarEvent, calendar: GoogleCalendarListEntry) {
  return event.start?.timeZone ?? event.end?.timeZone ?? calendar.timeZone ?? null;
}

function orangeMetadata(raw: Json) {
  return Object.fromEntries(
    Object.entries(rawRecord(raw)).filter(([key]) => key.startsWith("orange")),
  ) as Record<string, Json>;
}

async function syncGmailForAccount(userId: string, account: GoogleConnectedAccount) {
  const list = await googleFetch<GmailListResponse>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=in:inbox newer_than:30d",
    undefined,
    account.id,
  );

  const messages = await Promise.all(
    (list.messages ?? []).map((message) =>
      googleFetch<GmailMessage>(
        userId,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=References`,
        undefined,
        account.id,
      ),
    ),
  );

  if (messages.length > 0) {
    const admin = getSupabaseAdmin();
    const messageIds = messages.map((message) => message.id);
    const { data: existingRows } = await admin
      .from("synced_emails")
      .select("gmail_message_id, labels, raw")
      .eq("user_id", userId)
      .in("gmail_message_id", messageIds);
    const existingRawByMessageId = new Map(
      (existingRows ?? []).map((row) => [row.gmail_message_id, orangeMetadata(row.raw)]),
    );
    const existingLabelsByMessageId = new Map(
      (existingRows ?? []).map((row) => [
        row.gmail_message_id,
        ((row.labels ?? []) as string[]).filter((label: string) => label.startsWith("OrangeOS/")),
      ]),
    );

    await admin.from("synced_emails").upsert(
      messages.map((message) => ({
        user_id: userId,
        connected_account_id: account.id,
        gmail_message_id: message.id,
        thread_id: message.threadId,
        sender: gmailHeader(message.payload?.headers, "From"),
        subject: gmailHeader(message.payload?.headers, "Subject"),
        snippet: message.snippet ?? null,
        received_at: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : null,
        labels: Array.from(new Set([...(message.labelIds ?? []), ...(existingLabelsByMessageId.get(message.id) ?? [])])),
        raw: {
          ...(message as unknown as Record<string, Json>),
          ...(existingRawByMessageId.get(message.id) ?? {}),
        },
      })),
      { onConflict: "user_id,connected_account_id,gmail_message_id" },
    );
  }

  return messages.length;
}

export async function syncGmailForUser(userId: string, connectedAccountId?: string | null) {
  const accounts = (await listGoogleConnectedAccounts(userId)).filter(
    (account) => !connectedAccountId || account.id === connectedAccountId,
  );
  const counts = await Promise.all(accounts.map((account) => syncGmailForAccount(userId, account)));

  return counts.reduce((total, count) => total + count, 0);
}

async function syncCalendarForAccount(userId: string, account: GoogleConnectedAccount) {
  const timeMin = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
  const admin = getSupabaseAdmin();
  const calendars = await listGoogleCalendars(userId, account.id);
  const calendarItems = calendars.items ?? [];

  if (calendarItems.length) {
    await admin.from("synced_calendars").upsert(
      calendarItems.map((calendar) => ({
        user_id: userId,
        connected_account_id: account.id,
        google_calendar_id: calendar.id,
        summary: calendar.summary ?? null,
        description: calendar.description ?? null,
        time_zone: calendar.timeZone ?? null,
        background_color: calendar.backgroundColor ?? null,
        foreground_color: calendar.foregroundColor ?? null,
        access_role: calendar.accessRole ?? null,
        is_primary: calendar.primary ?? false,
        selected: calendar.selected ?? true,
        raw: calendar as unknown as Json,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,connected_account_id,google_calendar_id" },
    );
  }

  const readableCalendars = calendarItems.filter((calendar) => canReadCalendar(calendar.accessRole));
  const eventLists = await Promise.all(
    readableCalendars.map(async (calendar) => ({
      calendar,
      events: (await listGoogleCalendarEvents({
        calendarId: calendar.id,
        connectedAccountId: account.id,
        timeMax,
        timeMin,
        userId,
      })).items ?? [],
    })),
  );
  const eventRows = eventLists.flatMap(({ calendar, events }) =>
    events.map((event) => ({
      user_id: userId,
      connected_account_id: account.id,
      google_event_id: event.id,
      calendar_id: calendar.id,
      title: event.summary ?? null,
      starts_at: eventStart(event),
      ends_at: eventEnd(event),
      location: event.location ?? null,
      attendees: (event.attendees ?? []) as Json,
      status: event.status ?? null,
      html_link: event.htmlLink ?? null,
      creator: (event.creator ?? null) as Json,
      organizer: (event.organizer ?? null) as Json,
      recurring_event_id: event.recurringEventId ?? null,
      all_day: isAllDayEvent(event),
      time_zone: eventTimeZone(event, calendar),
      google_updated_at: event.updated ?? null,
      raw: event as unknown as Json,
      updated_at: new Date().toISOString(),
    })),
  );

  if (eventRows.length) {
    await admin.from("synced_calendar_events").upsert(
      eventRows,
      { onConflict: "user_id,connected_account_id,calendar_id,google_event_id" },
    );
  }

  return eventRows.length;
}

export async function syncCalendarForUser(userId: string, connectedAccountId?: string | null) {
  const accounts = (await listGoogleConnectedAccounts(userId)).filter(
    (account) => !connectedAccountId || account.id === connectedAccountId,
  );
  const counts = await Promise.all(accounts.map((account) => syncCalendarForAccount(userId, account)));

  return counts.reduce((total, count) => total + count, 0);
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
