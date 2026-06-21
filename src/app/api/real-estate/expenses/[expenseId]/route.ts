import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ expenseId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { expenseId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("project_expenses")
    .update({
      category: body.category,
      vendor: body.vendor || "Unassigned vendor",
      amount: body.amount ?? 0,
      expense_date: body.date,
      status: body.status ?? "Paid",
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { expenseId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("project_expenses").delete().eq("id", expenseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
