import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dbSettings } from "@/lib/ledger/mapper";

export async function PUT(request: Request) {
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
    .from("ledger_settings")
    .upsert({
      user_id: claimsData.claims.sub,
      monthly_base: Number(body.monthlyBase ?? 0),
      split_needs: Number(body.splitNeeds ?? 40),
      split_wants: Number(body.splitWants ?? 40),
      split_savings: Number(body.splitSavings ?? 20),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: dbSettings(data) });
}
