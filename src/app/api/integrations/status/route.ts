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
  const [{ data: profile, error: profileError }, { data: accounts, error }] = await Promise.all([
    admin.from("profiles").select("email, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    admin
      .from("connected_accounts")
      .select("provider, account_email, scopes, expires_at, updated_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .order("updated_at", { ascending: false }),
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const primaryAccount = accounts?.[0] ?? null;

  return NextResponse.json({
    profile: {
      email: profile?.email ?? user.email ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    google: {
      connected: Boolean(primaryAccount),
      accountEmail: primaryAccount?.account_email ?? null,
      scopes: primaryAccount?.scopes ?? [],
      expiresAt: primaryAccount?.expires_at ?? null,
      updatedAt: primaryAccount?.updated_at ?? null,
      accounts: (accounts ?? []).map((account) => ({
        provider: account.provider,
        accountEmail: account.account_email,
        scopes: account.scopes ?? [],
        expiresAt: account.expires_at,
        updatedAt: account.updated_at,
      })),
    },
  });
}

export async function DELETE() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("connected_accounts").delete().eq("user_id", user.id).eq("provider", "google");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
