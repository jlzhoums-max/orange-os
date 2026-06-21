import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { separateEmailsForUser } from "@/lib/google/separator";
import { syncGmailForUser } from "@/lib/google/sync";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const synced = await syncGmailForUser(user.id);
  const separated = await separateEmailsForUser(user.id);

  return NextResponse.json({
    synced,
    ...separated,
    refreshedAt: new Date().toISOString(),
  });
}
