import { getRequiredServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export class GoogleIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: "google_not_connected" | "google_reconnect_required" | "google_api_error",
    public readonly status = 409,
  ) {
    super(message);
    this.name = "GoogleIntegrationError";
  }
}

export function googleErrorPayload(error: unknown) {
  if (error instanceof GoogleIntegrationError) {
    return {
      body: {
        error: error.message,
        code: error.code,
        reconnectRequired: error.code === "google_reconnect_required" || error.code === "google_not_connected",
      },
      status: error.status,
    };
  }

  return {
    body: { error: error instanceof Error ? error.message : "Google request failed." },
    status: 502,
  };
}

export async function getGoogleAccessToken(userId: string) {
  const admin = getSupabaseAdmin();
  const { data: account, error } = await admin
    .from("connected_accounts")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (error || !account) {
    throw new GoogleIntegrationError("Google account is not connected. Reconnect Google from Profile.", "google_not_connected");
  }

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  const hasFreshToken = account.access_token && expiresAt - Date.now() > 60_000;

  if (hasFreshToken) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new GoogleIntegrationError("Google needs to be reconnected from Profile.", "google_reconnect_required");
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
    throw new GoogleIntegrationError("Google needs to be reconnected from Profile.", "google_reconnect_required");
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
    if (response.status === 401 || response.status === 403) {
      throw new GoogleIntegrationError("Google permissions need to be refreshed. Reconnect Google from Profile.", "google_reconnect_required");
    }

    throw new GoogleIntegrationError(`Google API request failed: ${response.status}`, "google_api_error", 502);
  }

  return (await response.json()) as T;
}
