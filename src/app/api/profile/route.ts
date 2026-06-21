import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
});

export async function PATCH(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile" }, { status: 400 });
  }

  const fullName = parsed.data.fullName;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("email, full_name, avatar_url")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: {
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
    },
  });
}
