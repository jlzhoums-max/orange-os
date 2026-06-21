import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  if (!hasSupabasePublicEnv()) {
    return <AuthPanel mode="missing-env" />;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/");
  }

  return <AuthPanel mode="login" />;
}
