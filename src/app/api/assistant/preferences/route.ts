import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const preferencesSchema = z.object({
  default_provider: z.enum(["openai", "anthropic"]).optional(),
  default_model_mode: z.enum(["cost", "balanced", "power"]).optional(),
  developer_mode_enabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const parsed = preferencesSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assistant_preferences").upsert({
    user_id: user.id,
    assistant_name: "Chéng zǐ",
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}
