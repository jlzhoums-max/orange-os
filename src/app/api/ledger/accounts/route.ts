import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dbAccount } from "@/lib/ledger/mapper";
import { accountCategory, type LedgerAccountType } from "@/lib/ledger/types";

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
  const type = (body.type ?? "checking") as LedgerAccountType;
  const { data, error } = await supabase
    .from("ledger_accounts")
    .insert({
      user_id: claimsData.claims.sub,
      name: body.name || "New account",
      account_type: type,
      category: accountCategory(type),
      balance: Number(body.balance ?? 0),
      institution: body.institution ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: dbAccount(data) });
}
