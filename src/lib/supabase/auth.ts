import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export function isAllowedUserEmail(email: string | null | undefined) {
  const allowedEmails = process.env.AUTH_ALLOWED_EMAILS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedEmails?.length) {
    return true;
  }

  return Boolean(email && allowedEmails.includes(email.toLowerCase()));
}

export async function getAuthenticatedUser(supabase: ServerSupabaseClient): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  if (!isAllowedUserEmail(data.user.email)) {
    await supabase.auth.signOut();
    return null;
  }

  return data.user;
}
