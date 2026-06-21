import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { listGoogleConnectedAccounts } from "@/lib/google/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listGoogleConnectedAccounts(user.id);

  return NextResponse.json({
    accounts,
    connectUrl: "/api/integrations/google/connect?next=/calendar",
  });
}
