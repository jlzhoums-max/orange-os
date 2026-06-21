import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getConnectedAccountIdForMessage(userId: string, messageId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("synced_emails")
    .select("connected_account_id")
    .eq("user_id", userId)
    .eq("gmail_message_id", messageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.connected_account_id ?? null;
}
