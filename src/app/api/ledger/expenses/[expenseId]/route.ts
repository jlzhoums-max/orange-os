import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { dbExpense } from "@/lib/ledger/mapper";

type Params = {
  params: Promise<{ expenseId: string }>;
};

export async function PUT(request: Request, { params }: Params) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { expenseId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const { data, error } = await supabase
    .from("ledger_expenses")
    .update({
      label: body.label || "Untitled expense",
      amount: Number(body.amount ?? 0),
      bucket: body.bucket ?? "needs",
      expense_date: date,
      month: date.slice(0, 7),
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: dbExpense(data) });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { expenseId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("ledger_expenses").delete().eq("id", expenseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
