import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { defaultHomeLayout, homeModules, normalizeHomeLayout } from "@/lib/assistant/modules";

export async function GET() {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const [preferencesResult, layoutResult, messagesResult] = await Promise.all([
    admin.from("assistant_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("assistant_layouts").select("*").eq("user_id", user.id).eq("surface", "home").maybeSingle(),
    admin
      .from("assistant_messages")
      .select("id, role, content, provider, model, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (preferencesResult.error || layoutResult.error || messagesResult.error) {
    return NextResponse.json(
      {
        error: preferencesResult.error?.message ?? layoutResult.error?.message ?? messagesResult.error?.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    preferences: preferencesResult.data ?? {
      assistant_name: "Chéng zǐ",
      default_provider: "openai",
      default_model_mode: "cost",
      developer_mode_enabled: false,
      memory: {},
    },
    homeLayout: normalizeHomeLayout(layoutResult.data?.modules ?? defaultHomeLayout),
    modules: homeModules,
    recentMessages: (messagesResult.data ?? []).reverse(),
  });
}
