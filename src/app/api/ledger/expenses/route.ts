import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dbExpense } from "@/lib/ledger/mapper";

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
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const { data, error } = await supabase
    .from("ledger_expenses")
    .insert({
      user_id: claimsData.claims.sub,
      label: body.label || "Untitled expense",
      amount: Number(body.amount ?? 0),
      bucket: body.bucket ?? "needs",
      expense_date: date,
      month: date.slice(0, 7),
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: dbExpense(data) });
}
