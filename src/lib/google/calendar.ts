import { googleFetch } from "@/lib/google/server";

type GoogleCalendarEventInput = {
  attendees?: string[];
  calendarId?: string;
  connectedAccountId?: string | null;
  description?: string;
  endsAt: string;
  location?: string;
  startsAt: string;
  timeZone?: string;
  title: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: "none" | "freeBusyReader" | "reader" | "writer" | "owner";
  primary?: boolean;
  selected?: boolean;
  timeZone?: string;
};

export type GoogleCalendarListResponse = {
  items?: GoogleCalendarListEntry[];
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
  creator?: unknown;
  organizer?: unknown;
  recurringEventId?: string;
  updated?: string;
};

export type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

export function canReadCalendar(accessRole?: string | null) {
  return accessRole === "reader" || accessRole === "writer" || accessRole === "owner";
}

export function canWriteCalendar(accessRole?: string | null) {
  return accessRole === "writer" || accessRole === "owner";
}

export async function listGoogleCalendars(userId: string, connectedAccountId: string) {
  return googleFetch<GoogleCalendarListResponse>(
    userId,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader",
    undefined,
    connectedAccountId,
  );
}

export async function listGoogleCalendarEvents({
  calendarId,
  connectedAccountId,
  maxResults = 250,
  timeMax,
  timeMin,
  userId,
}: {
  calendarId: string;
  connectedAccountId: string;
  maxResults?: number;
  timeMax: string;
  timeMin: string;
  userId: string;
}) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);

  return googleFetch<GoogleCalendarEventsResponse>(userId, url.toString(), undefined, connectedAccountId);
}

export async function createCalendarEvent(userId: string, input: GoogleCalendarEventInput) {
  const calendarId = input.calendarId ?? "primary";
  return googleFetch<GoogleCalendarEvent>(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attendees: input.attendees?.map((email) => ({ email })),
        description: input.description || undefined,
        end: {
          dateTime: input.endsAt,
          timeZone: input.timeZone,
        },
        location: input.location || undefined,
        start: {
          dateTime: input.startsAt,
          timeZone: input.timeZone,
        },
        summary: input.title,
      }),
    },
    input.connectedAccountId,
  );
}

export async function createPrimaryCalendarEvent(userId: string, input: GoogleCalendarEventInput) {
  return createCalendarEvent(userId, { ...input, calendarId: "primary" });
}
