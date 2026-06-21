import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dbAccount, dbExpense, dbSettings } from "@/lib/ledger/mapper";

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [expenses, accounts, settings] = await Promise.all([
    supabase.from("ledger_expenses").select("*").order("expense_date", { ascending: false }).limit(500),
    supabase.from("ledger_accounts").select("*").order("category").order("account_type").order("name"),
    supabase.from("ledger_settings").select("*").maybeSingle(),
  ]);

  if (expenses.error || accounts.error || settings.error) {
    return NextResponse.json(
      { error: expenses.error?.message ?? accounts.error?.message ?? settings.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    expenses: (expenses.data ?? []).map(dbExpense),
    accounts: (accounts.data ?? []).map(dbAccount),
    settings: dbSettings(settings.data),
  });
}
