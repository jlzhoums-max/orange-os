import { getRequiredServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export async function getGoogleAccessToken(userId: string) {
  const admin = getSupabaseAdmin();
  const { data: account, error } = await admin
    .from("connected_accounts")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (error || !account) {
    throw new Error("Google account is not connected.");
  }

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  const hasFreshToken = account.access_token && expiresAt - Date.now() > 60_000;

  if (hasFreshToken) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Google refresh token is missing. Reconnect Google with offline access.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getRequiredServerEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredServerEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const token = (await response.json()) as GoogleTokenResponse;
  const nextExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await admin
    .from("connected_accounts")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? account.refresh_token,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return token.access_token;
}

export async function googleFetch<T>(userId: string, url: string, init?: RequestInit) {
  const token = await getGoogleAccessToken(userId);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
