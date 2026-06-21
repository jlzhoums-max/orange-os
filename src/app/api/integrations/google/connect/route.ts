import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequiredServerEnv, hasSupabasePublicEnv } from "@/lib/env";
import { getAppOrigin, safeNextPath } from "@/lib/app-url";
import { googleIntegrationScopes } from "@/lib/google/scopes";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.redirect(`${getAppOrigin(request)}/login`);
  }

  const state = randomBytes(24).toString("hex");
  const next = safeNextPath(new URL(request.url).searchParams.get("next") ?? "/");
  const cookieStore = await cookies();
  cookieStore.set("orange_google_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  cookieStore.set("orange_google_oauth_next", next, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const appOrigin = getAppOrigin(request);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getRequiredServerEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${appOrigin}/api/integrations/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleIntegrationScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
