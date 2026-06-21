import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleIntegrationScopes } from "@/lib/google/scopes";
import { getAppOrigin, safeNextPath } from "@/lib/app-url";
import { isAllowedUserEmail } from "@/lib/supabase/auth";
import { upsertGoogleConnectedAccount } from "@/lib/google/server";

function googleProviderAccountId(user: { id: string; email?: string | null; identities?: Array<{ provider?: string; identity_data?: { sub?: string }; identity_id?: string }> }) {
  const googleIdentity = user.identities?.find((identity) => identity.provider === "google");
  return googleIdentity?.identity_data?.sub ?? googleIdentity?.identity_id ?? user.email ?? user.id;
}

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

      if (!isAllowedUserEmail(user.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${appOrigin}/login?error=not-allowed`);
      }

      if (
        (session?.provider_token || session?.provider_refresh_token) &&
        process.env.SUPABASE_SECRET_KEY
      ) {
        await upsertGoogleConnectedAccount({
          accessToken: session.provider_token ?? null,
          expiresIn: session.expires_at ? Math.max(0, session.expires_at - Math.floor(Date.now() / 1000)) : null,
          profile: {
            email: user.email ?? null,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? null,
            picture: user.user_metadata?.avatar_url ?? null,
            sub: googleProviderAccountId(user),
          },
          refreshToken: session.provider_refresh_token ?? null,
          scopes: googleIntegrationScopes,
          userId: user.id,
        });
      }

      return NextResponse.redirect(`${appOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${appOrigin}/login?error=auth-code`);
}
