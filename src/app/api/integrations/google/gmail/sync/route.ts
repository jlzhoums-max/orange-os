import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { googleErrorPayload } from "@/lib/google/server";
import { syncGmailForUser } from "@/lib/google/sync";

export async function POST() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  try {
    const synced = await syncGmailForUser(userId);

    return NextResponse.json({ synced });
  } catch (error) {
    const payload = googleErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  }
}
