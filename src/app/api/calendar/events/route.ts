import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { canWriteCalendar, createCalendarEvent } from "@/lib/google/calendar";
import type { Json } from "@/lib/database.types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createEventSchema = z.object({
  attendees: z.array(z.email()).optional().default([]),
  calendarId: z.string().min(1),
  connectedAccountId: z.uuid(),
  description: z.string().optional(),
  endsAt: z.iso.datetime(),
  location: z.string().optional(),
  startsAt: z.iso.datetime(),
  timeZone: z.string().optional(),
  title: z.string().min(1),
});

function defaultStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  return start.toISOString();
}

function defaultEnd() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 45);
  return end.toISOString();
}

export async function GET(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? defaultStart();
  const end = searchParams.get("end") ?? defaultEnd();
  const calendarIds = searchParams.get("calendarIds")?.split(",").filter(Boolean) ?? [];
  const admin = getSupabaseAdmin();
  let query = admin
    .from("synced_calendar_events")
    .select(
      "id, connected_account_id, calendar_id, google_event_id, title, starts_at, ends_at, location, attendees, status, html_link, all_day, time_zone, google_updated_at",
    )
    .eq("user_id", user.id)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (calendarIds.length) {
    query = query.in("calendar_id", calendarIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
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

  const parsed = createEventSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid event" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: calendar, error: calendarError } = await admin
    .from("synced_calendars")
    .select("access_role, time_zone")
    .eq("user_id", user.id)
    .eq("connected_account_id", parsed.data.connectedAccountId)
    .eq("google_calendar_id", parsed.data.calendarId)
    .maybeSingle();

  if (calendarError) {
    return NextResponse.json({ error: calendarError.message }, { status: 500 });
  }

  if (!calendar || !canWriteCalendar(calendar.access_role)) {
    return NextResponse.json({ error: "This calendar is read-only." }, { status: 403 });
  }

  const event = await createCalendarEvent(user.id, {
    attendees: parsed.data.attendees,
    calendarId: parsed.data.calendarId,
    connectedAccountId: parsed.data.connectedAccountId,
    description: parsed.data.description,
    endsAt: parsed.data.endsAt,
    location: parsed.data.location,
    startsAt: parsed.data.startsAt,
    timeZone: parsed.data.timeZone ?? calendar.time_zone ?? undefined,
    title: parsed.data.title,
  });
  const startsAt = event.start?.dateTime ?? event.start?.date ?? parsed.data.startsAt;
  const endsAt = event.end?.dateTime ?? event.end?.date ?? parsed.data.endsAt;

  const { data, error } = await admin
    .from("synced_calendar_events")
    .upsert(
      {
        user_id: user.id,
        connected_account_id: parsed.data.connectedAccountId,
        google_event_id: event.id,
        calendar_id: parsed.data.calendarId,
        title: event.summary ?? parsed.data.title,
        starts_at: startsAt,
        ends_at: endsAt,
        location: event.location ?? parsed.data.location ?? null,
        attendees: (event.attendees ?? []).map((attendee) => attendee.email) as Json,
        status: event.status ?? null,
        html_link: event.htmlLink ?? null,
        creator: (event.creator ?? null) as Json,
        organizer: (event.organizer ?? null) as Json,
        recurring_event_id: event.recurringEventId ?? null,
        all_day: Boolean(event.start?.date && !event.start.dateTime),
        time_zone: event.start?.timeZone ?? event.end?.timeZone ?? parsed.data.timeZone ?? calendar.time_zone ?? null,
        google_updated_at: event.updated ?? null,
        raw: event as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connected_account_id,calendar_id,google_event_id" },
    )
    .select(
      "id, connected_account_id, calendar_id, google_event_id, title, starts_at, ends_at, location, attendees, status, html_link, all_day, time_zone, google_updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
