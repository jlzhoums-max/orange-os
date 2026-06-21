import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({
      google: { connected: false, reason: "Supabase env is not configured" },
    });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({
      google: { connected: false, reason: "SUPABASE_SECRET_KEY is not configured" },
    });
  }

  const admin = getSupabaseAdmin();
  const { data: account } = await admin
    .from("connected_accounts")
    .select("provider, account_email, scopes, expires_at, updated_at")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();

  return NextResponse.json({
    google: {
      connected: Boolean(account),
      accountEmail: account?.account_email ?? null,
      scopes: account?.scopes ?? [],
      expiresAt: account?.expires_at ?? null,
      updatedAt: account?.updated_at ?? null,
    },
  });
}
