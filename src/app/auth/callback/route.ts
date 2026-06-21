import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { googleIntegrationScopes } from "@/lib/google/scopes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

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
        await admin.from("connected_accounts").upsert(
          {
            user_id: user.id,
            provider: "google",
            account_email: user.email ?? null,
            scopes: googleIntegrationScopes,
            access_token: session.provider_token ?? null,
            refresh_token: session.provider_refresh_token ?? null,
            expires_at: session.expires_at
              ? new Date(session.expires_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        );
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code`);
}
