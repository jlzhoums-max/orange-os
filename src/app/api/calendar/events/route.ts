import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { googleFetch } from "@/lib/google/server";
import type { Json } from "@/lib/database.types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CalendarEventRequest = {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
};

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
  attendees?: unknown[];
};

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function calendarEventPayload(body: CalendarEventRequest) {
  const title = body.title?.trim() || "New event";
  const date = body.date || new Date().toISOString().slice(0, 10);
  const startTime = body.startTime || "09:00";
  const endTime = body.endTime || "10:00";

  if (body.allDay) {
    return {
      summary: title,
      description: body.notes?.trim() || undefined,
      location: body.location?.trim() || undefined,
      start: { date },
      end: { date: nextDate(date) },
    };
  }

  return {
    summary: title,
    description: body.notes?.trim() || undefined,
    location: body.location?.trim() || undefined,
    start: { dateTime: localDateTime(date, startTime) },
    end: { dateTime: localDateTime(date, endTime) },
  };
}

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CalendarEventRequest;
  const eventPayload = calendarEventPayload(body);

  let googleEvent: GoogleCalendarEvent;
  try {
    googleEvent = await googleFetch<GoogleCalendarEvent>(
      user.id,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar event could not be created." },
      { status: 502 },
    );
  }

  const admin = getSupabaseAdmin();
  const { error: upsertError } = await admin.from("synced_calendar_events").upsert(
    {
      user_id: user.id,
      google_event_id: googleEvent.id,
      calendar_id: "primary",
      title: googleEvent.summary ?? eventPayload.summary ?? null,
      starts_at: googleEvent.start?.dateTime ?? googleEvent.start?.date ?? null,
      ends_at: googleEvent.end?.dateTime ?? googleEvent.end?.date ?? null,
      location: googleEvent.location ?? null,
      attendees: (googleEvent.attendees ?? []) as Json,
      raw: googleEvent as Json,
    },
    { onConflict: "user_id,calendar_id,google_event_id" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ event: googleEvent });
}
