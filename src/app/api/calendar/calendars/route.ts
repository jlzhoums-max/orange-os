import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateCalendarSchema = z.object({
  connectedAccountId: z.uuid(),
  googleCalendarId: z.string().min(1),
  selected: z.boolean(),
});

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
  const { data, error } = await admin
    .from("synced_calendars")
    .select(
      "id, connected_account_id, google_calendar_id, summary, description, time_zone, background_color, foreground_color, access_role, is_primary, selected, updated_at",
    )
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("summary", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calendars: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateCalendarSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid calendar update" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("synced_calendars")
    .update({
      selected: parsed.data.selected,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("connected_account_id", parsed.data.connectedAccountId)
    .eq("google_calendar_id", parsed.data.googleCalendarId)
    .select(
      "id, connected_account_id, google_calendar_id, summary, description, time_zone, background_color, foreground_color, access_role, is_primary, selected, updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json({ calendar: data });
}
