import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { googleIntegrationScopes } from "@/lib/google/scopes";
import { getAppOrigin, safeNextPath } from "@/lib/app-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appOrigin = getAppOrigin(request);
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const session = data.session;
      const user = data.user;

      if (
        (session?.provider_token || session?.provider_refresh_token) &&
        process.env.SUPABASE_SECRET_KEY
      ) {
        const admin = getSupabaseAdmin();
        const { data: existingAccount } = await admin
          .from("connected_accounts")
          .select("refresh_token")
          .eq("user_id", user.id)
          .eq("provider", "google")
          .maybeSingle();

        await admin.from("connected_accounts").upsert(
          {
            user_id: user.id,
            provider: "google",
            account_email: user.email ?? null,
            scopes: googleIntegrationScopes,
            access_token: session.provider_token ?? null,
            refresh_token: session.provider_refresh_token ?? existingAccount?.refresh_token ?? null,
            expires_at: session.expires_at
              ? new Date(session.expires_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        );
      }

      return NextResponse.redirect(`${appOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${appOrigin}/login?error=auth-code`);
}
