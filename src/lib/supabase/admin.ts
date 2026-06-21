import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequiredServerEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      getRequiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getRequiredServerEnv("SUPABASE_SECRET_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return adminClient;
}
