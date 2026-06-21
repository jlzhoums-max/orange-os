import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { normalizeHomeLayout } from "@/lib/assistant/modules";
import { createPrimaryCalendarEvent } from "@/lib/google/calendar";
import { listGoogleConnectedAccounts } from "@/lib/google/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update_layout"),
    surface: z.literal("home"),
    modules: z.array(z.object({
      id: z.enum(["hero", "quick_capture", "focus", "inbox", "calendar", "market", "ai_brief", "data_connections"]),
      visible: z.boolean(),
    })),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("remember_preference"),
    key: z.string().min(1).max(80),
    value: z.string().min(1).max(1000),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().min(1).max(240),
    reason: z.string().max(1000),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_ledger_expense"),
    label: z.string().min(1).max(240),
    amount: z.number().positive(),
    bucket: z.enum(["needs", "wants", "savings"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tags: z.array(z.string().min(1).max(40)).max(10),
    notes: z.string().max(1000),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_email_draft"),
    messageId: z.string().min(1),
    body: z.string().min(1).max(20_000),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("email_message_action"),
    messageId: z.string().min(1),
    action: z.enum(["archive", "unarchive", "markRead", "markUnread", "label", "snooze", "unsnooze"]),
    label: z.enum(["OrangeOS/Important", "OrangeOS/Needs Reply", "OrangeOS/Read Later", "OrangeOS/News", "OrangeOS/Tools"]).optional(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("create_calendar_event"),
    title: z.string().min(1).max(240),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    location: z.string().max(500),
    description: z.string().max(2000),
    attendees: z.array(z.string().email()).max(20),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("developer_request"),
    request: z.string().min(1).max(4000),
    summary: z.string(),
  }),
]);

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const parsed = actionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const action = parsed.data;

  if (action.type === "update_layout") {
    const modules = normalizeHomeLayout(action.modules);
    const { error } = await admin.from("assistant_layouts").upsert({
      user_id: user.id,
      surface: action.surface,
      modules: modules as unknown as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,surface" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applied: true, layout: modules });
  }

  if (action.type === "remember_preference") {
    const { data: existing, error: readError } = await admin
      .from("assistant_preferences")
      .select("memory")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const currentMemory = existing?.memory && typeof existing.memory === "object" && !Array.isArray(existing.memory)
      ? existing.memory
      : {};
    const nextMemory = {
      ...currentMemory,
      [action.key]: action.value,
    };

    const { error } = await admin.from("assistant_preferences").upsert({
      user_id: user.id,
      assistant_name: "Chéng zǐ",
      memory: nextMemory,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applied: true, memory: nextMemory });
  }

  if (action.type === "create_task") {
    const { data, error } = await admin.from("assistant_tasks").insert({
      user_id: user.id,
      title: action.title,
      reason: action.reason,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applied: true, task: data });
  }

  if (action.type === "create_ledger_expense") {
    const { data, error } = await supabase
      .from("ledger_expenses")
      .insert({
        user_id: user.id,
        label: action.label,
        amount: action.amount,
        bucket: action.bucket,
        expense_date: action.date,
        month: action.date.slice(0, 7),
        tags: action.tags,
        notes: action.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      applied: true,
      expense: {
        id: data.id,
        label: data.label,
        amount: Number(data.amount ?? 0),
        bucket: data.bucket,
        date: data.expense_date,
        month: data.month,
        tags: data.tags ?? [],
        notes: data.notes ?? "",
      },
    });
  }

  if (action.type === "create_email_draft") {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/email/drafts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        body: action.body,
        messageId: action.messageId,
      }),
    });
    const payload = await response.json() as { draftId?: string; error?: string };

    if (!response.ok || !payload.draftId) {
      return NextResponse.json({ error: payload.error ?? "Gmail draft could not be created." }, { status: response.status || 500 });
    }

    return NextResponse.json({
      applied: true,
      draft: {
        draftId: payload.draftId,
        messageId: action.messageId,
      },
    });
  }

  if (action.type === "email_message_action") {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/email/messages/${encodeURIComponent(action.messageId)}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        action: action.action,
        label: action.label,
      }),
    });
    const payload = await response.json() as { error?: string; labels?: string[]; messageId?: string; threadId?: string };

    if (!response.ok) {
      return NextResponse.json({ error: payload.error ?? "Email action could not be applied." }, { status: response.status || 500 });
    }

    return NextResponse.json({
      applied: true,
      email: {
        action: action.action,
        labels: payload.labels ?? [],
        messageId: payload.messageId ?? action.messageId,
        threadId: payload.threadId ?? null,
      },
    });
  }

  if (action.type === "create_calendar_event") {
    const account = (await listGoogleConnectedAccounts(user.id))[0];
    const event = await createPrimaryCalendarEvent(user.id, {
      attendees: action.attendees,
      description: action.description,
      endsAt: action.endsAt,
      location: action.location,
      startsAt: action.startsAt,
      title: action.title,
    });
    const startsAt = event.start?.dateTime ?? action.startsAt;
    const endsAt = event.end?.dateTime ?? action.endsAt;

    await admin.from("synced_calendar_events").upsert(
      {
        user_id: user.id,
        connected_account_id: account?.id ?? null,
        google_event_id: event.id,
        calendar_id: "primary",
        title: event.summary ?? action.title,
        starts_at: startsAt,
        ends_at: endsAt,
        location: event.location ?? action.location,
        attendees: (event.attendees ?? []).map((attendee) => attendee.email),
        status: event.status ?? null,
        html_link: event.htmlLink ?? null,
        creator: (event.creator ?? null) as Json,
        organizer: (event.organizer ?? null) as Json,
        recurring_event_id: event.recurringEventId ?? null,
        all_day: Boolean(event.start?.date && !event.start.dateTime),
        time_zone: event.start?.timeZone ?? event.end?.timeZone ?? null,
        google_updated_at: event.updated ?? null,
        raw: event,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connected_account_id,calendar_id,google_event_id" },
    );

    return NextResponse.json({
      applied: true,
      calendarEvent: {
        id: event.id,
        title: event.summary ?? action.title,
        startsAt,
        endsAt,
        location: event.location ?? action.location,
      },
    });
  }

  const { error } = await admin.from("assistant_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: `Developer request queued: ${action.request}`,
    metadata: { developerRequest: action } satisfies Json,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    applied: true,
    developerRequest: action,
    note: "Developer mode request captured. Code changes still require a separate reviewed implementation step.",
  });
}
