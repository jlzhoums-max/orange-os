import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { projectId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("real_estate_projects")
    .update({
      name: body.name,
      address: body.address ?? null,
      project_type: body.type ?? null,
      status: body.status,
      risk: body.risk,
      estimated_value: body.estimatedValue ?? 0,
      purchase_price: body.purchasePrice ?? 0,
      target_budget: body.targetBudget ?? 0,
      progress: body.progress ?? 0,
      due: body.due ?? null,
      next_action: body.nextAction ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { projectId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("real_estate_projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
