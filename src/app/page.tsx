import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }
  }

  return <DashboardClient initialTimestamp={new Date().toISOString()} />;
}
