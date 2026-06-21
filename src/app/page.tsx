import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      redirect("/login");
    }
  }

  return <DashboardClient initialTimestamp={new Date().toISOString()} />;
}
