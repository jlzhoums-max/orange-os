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
  const { data: accounts } = await admin
    .from("connected_accounts")
    .select("id, provider, account_email, display_name, scopes, expires_at, updated_at, is_primary")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  const primary = accounts?.[0] ?? null;

  return NextResponse.json({
    google: {
      connected: Boolean(accounts?.length),
      accountEmail: primary?.account_email ?? null,
      accounts: accounts ?? [],
      scopes: primary?.scopes ?? [],
      expiresAt: primary?.expires_at ?? null,
      updatedAt: primary?.updated_at ?? null,
    },
  });
}
