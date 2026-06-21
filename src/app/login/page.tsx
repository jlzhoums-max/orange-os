import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  if (!hasSupabasePublicEnv()) {
    return <AuthPanel mode="missing-env" />;
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (user) {
    redirect("/");
  }

  return <AuthPanel mode="login" error={params?.error} />;
}
