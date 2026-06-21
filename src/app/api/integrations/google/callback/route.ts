import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAppOrigin, safeNextPath } from "@/lib/app-url";
import { googleIntegrationScopes } from "@/lib/google/scopes";
import {
  exchangeGoogleAuthCode,
  fetchGoogleProfile,
  googleScopesFromToken,
  upsertGoogleConnectedAccount,
} from "@/lib/google/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { syncCalendarForUser } from "@/lib/google/sync";

export async function GET(request: Request) {
  const appOrigin = getAppOrigin(request);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("orange_google_oauth_state")?.value;
  const next = safeNextPath(cookieStore.get("orange_google_oauth_next")?.value ?? "/calendar");
  cookieStore.delete("orange_google_oauth_state");
  cookieStore.delete("orange_google_oauth_next");

  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.redirect(`${appOrigin}${next}?google=missing-env`);
  }

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(`${appOrigin}${next}?google=state`);
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.redirect(`${appOrigin}/login`);
  }

  try {
    const redirectUri = `${appOrigin}/api/integrations/google/callback`;
    const token = await exchangeGoogleAuthCode(code, redirectUri);
    const profile = await fetchGoogleProfile(token.access_token);
    const tokenScopes = googleScopesFromToken(token);

    const account = await upsertGoogleConnectedAccount({
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      profile,
      refreshToken: token.refresh_token ?? null,
      scopes: tokenScopes.length ? tokenScopes : googleIntegrationScopes,
      userId: user.id,
    });

    if (next === "/calendar") {
      try {
        await syncCalendarForUser(user.id, account.id);
      } catch {
        return NextResponse.redirect(`${appOrigin}${next}?google=connected&sync=failed`);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? encodeURIComponent(error.message) : "failed";
    return NextResponse.redirect(`${appOrigin}${next}?google=${reason}`);
  }

  return NextResponse.redirect(`${appOrigin}${next}?google=connected`);
}
