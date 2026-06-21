import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getConnectedAccountIdForMessage } from "@/lib/google/message-account";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const reminderSchema = z.object({
  reminderAt: z.string().datetime().nullable(),
});

function rawRecord(raw: Json): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reminderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Reminder must be a valid ISO datetime or null." }, { status: 400 });
  }

  const { messageId } = await context.params;
  const connectedAccountId = await getConnectedAccountIdForMessage(user.id, messageId);
  const admin = getSupabaseAdmin();
  let readQuery = admin
    .from("synced_emails")
    .select("raw")
    .eq("user_id", user.id)
    .eq("gmail_message_id", messageId);
  if (connectedAccountId) {
    readQuery = readQuery.eq("connected_account_id", connectedAccountId);
  }
  const { data: existing, error: readError } = await readQuery.maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Synced email was not found." }, { status: 404 });
  }

  let updateQuery = admin
    .from("synced_emails")
    .update({
      raw: {
        ...rawRecord(existing.raw),
        orangeReminderAt: parsed.data.reminderAt,
        orangeReminderUpdatedAt: new Date().toISOString(),
      },
    })
    .eq("user_id", user.id)
    .eq("gmail_message_id", messageId);
  if (connectedAccountId) {
    updateQuery = updateQuery.eq("connected_account_id", connectedAccountId);
  }
  const { error: updateError } = await updateQuery;

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    messageId,
    reminderAt: parsed.data.reminderAt,
  });
}
