import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchMarketQuotes } from "@/lib/market/quotes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "SPY,QQQ,VNQ")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  const quotes = await fetchMarketQuotes(symbols);

  if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const user = await getAuthenticatedUser(supabase);

    if (user) {
      const admin = getSupabaseAdmin();
      await admin.from("market_quotes").insert(
        quotes.map((quote) => ({
          symbol: quote.symbol,
          price: quote.price,
          change_percent: quote.changePercent,
          provider: quote.provider,
          raw: quote.raw,
        })),
      );
    }
  }

  return NextResponse.json({ quotes });
}
