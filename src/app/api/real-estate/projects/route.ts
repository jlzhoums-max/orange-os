import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { dbProjectToTrackerProject, type ProjectWithRelations } from "@/lib/real-estate/mapper";

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("real_estate_projects")
    .select("*, project_expenses(*, expense_attachments(*))")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    projects: (data as ProjectWithRelations[]).map(dbProjectToTrackerProject),
  });
}

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("real_estate_projects")
    .insert({
      user_id: user.id,
      name: body.name || "Untitled project",
      address: body.address ?? null,
      project_type: body.type ?? null,
      status: body.status ?? "Lead",
      risk: body.risk ?? "Low",
      estimated_value: body.estimatedValue ?? 0,
      purchase_price: body.purchasePrice ?? 0,
      target_budget: body.targetBudget ?? 0,
      progress: body.progress ?? 0,
      due: body.due ?? null,
      next_action: body.nextAction ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
