import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("project_expenses")
    .insert({
      user_id: claimsData.claims.sub,
      project_id: body.projectId,
      category: body.category,
      vendor: body.vendor || "Unassigned vendor",
      amount: body.amount ?? 0,
      expense_date: body.date,
      status: body.status ?? "Paid",
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: data });
}
