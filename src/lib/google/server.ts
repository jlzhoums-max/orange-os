import { getRequiredServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export type GoogleConnectedAccount = {
  id: string;
  account_email: string | null;
  avatar_url?: string | null;
  display_name: string | null;
  is_primary: boolean;
  provider_account_id?: string | null;
};

export type GoogleAccountProfile = {
  email: string | null;
  name: string | null;
  picture: string | null;
  sub: string;
};

export async function listGoogleConnectedAccounts(userId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("connected_accounts")
    .select("id, account_email, avatar_url, display_name, is_primary, provider_account_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GoogleConnectedAccount[];
}

export async function upsertGoogleConnectedAccount({
  accessToken,
  expiresIn,
  profile,
  refreshToken,
  scopes,
  userId,
}: {
  accessToken: string | null;
  expiresIn?: number | null;
  profile: GoogleAccountProfile;
  refreshToken?: string | null;
  scopes: string[];
  userId: string;
}) {
  const admin = getSupabaseAdmin();
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const { count } = await admin
    .from("connected_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "google");

  const row = {
    user_id: userId,
    provider: "google",
    provider_account_id: profile.sub,
    account_email: profile.email,
    display_name: profile.name,
    avatar_url: profile.picture,
    is_primary: (count ?? 0) === 0,
    scopes,
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from("connected_accounts")
    .select("refresh_token, is_primary")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("provider_account_id", profile.sub)
    .maybeSingle();

  const { data, error } = await admin
    .from("connected_accounts")
    .upsert(
      {
        ...row,
        is_primary: existing?.is_primary ?? row.is_primary,
        refresh_token: refreshToken ?? existing?.refresh_token ?? null,
      },
      { onConflict: "user_id,provider,provider_account_id" },
    )
    .select("id, account_email, avatar_url, display_name, is_primary, provider_account_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GoogleConnectedAccount;
}

export async function getGoogleAccessToken(userId: string, connectedAccountId?: string | null) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("connected_accounts")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google");

  if (connectedAccountId) {
    query = query.eq("id", connectedAccountId);
  } else {
    query = query.order("is_primary", { ascending: false }).order("created_at", { ascending: true }).limit(1);
  }

  const { data: account, error } = await query.maybeSingle();

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

export async function googleFetch<T>(userId: string, url: string, init?: RequestInit, connectedAccountId?: string | null) {
  const token = await getGoogleAccessToken(userId, connectedAccountId);
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

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google profile request failed: ${response.status}`);
  }

  return (await response.json()) as GoogleAccountProfile;
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getRequiredServerEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredServerEnv("GOOGLE_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google authorization failed: ${response.status}`);
  }

  return (await response.json()) as GoogleTokenResponse & { refresh_token?: string; scope?: string };
}

export function googleScopesFromToken(token: { scope?: string }) {
  return token.scope?.split(" ").filter(Boolean) ?? [];
}

export function jsonRecord(value: unknown): Json {
  return value as Json;
}
