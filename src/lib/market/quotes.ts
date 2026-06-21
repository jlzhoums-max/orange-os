import type { Json } from "@/lib/database.types";

export type Quote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  provider: string;
  raw: Json;
};

function parseStooqCsv(symbol: string, csv: string): Quote {
  const [, row] = csv.trim().split("\n");
  const cells = row?.split(",") ?? [];
  const close = Number(cells[6]);
  const open = Number(cells[3]);
  const changePercent = open ? ((close - open) / open) * 100 : null;

  return {
    symbol: symbol.toUpperCase(),
    price: Number.isFinite(close) ? close : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    provider: "stooq",
    raw: { csv },
  };
}

async function fetchAlphaVantageQuote(symbol: string) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;

  if (!key) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", key);

  const response = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error(`Alpha Vantage quote failed for ${symbol}`);
  }

  const raw = (await response.json()) as Record<string, Record<string, string>>;
  const quote = raw["Global Quote"] ?? {};
  const price = Number(quote["05. price"]);
  const changePercent = Number((quote["10. change percent"] ?? "").replace("%", ""));

  if (!Number.isFinite(price)) {
    throw new Error(`Alpha Vantage quote was unavailable for ${symbol}`);
  }

  return {
    symbol,
    price,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    provider: "alpha_vantage",
    raw: raw as Json,
  };
}

async function fetchStooqQuote(symbol: string) {
  const response = await fetch(
    `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`,
    { next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error(`Stooq quote failed for ${symbol}`);
  }

  return parseStooqCsv(symbol, await response.text());
}

function demoQuote(symbol: string): Quote {
  const demos: Record<string, { price: number; changePercent: number }> = {
    SPY: { price: 642.18, changePercent: 0.38 },
    QQQ: { price: 512.04, changePercent: 0.56 },
    VNQ: { price: 91.22, changePercent: -0.14 },
  };
  const quote = demos[symbol] ?? { price: 100, changePercent: 0 };

  return {
    symbol,
    price: quote.price,
    changePercent: quote.changePercent,
    provider: "demo",
    raw: { note: "Configure ALPHA_VANTAGE_API_KEY for live market data." },
  };
}

export async function fetchMarketQuotes(symbols: string[]) {
  const quotes: Quote[] = [];

  for (const symbol of symbols) {
    try {
      if (process.env.ALPHA_VANTAGE_API_KEY) {
        quotes.push(await fetchAlphaVantageQuote(symbol));
      } else {
        quotes.push(await fetchStooqQuote(symbol));
      }
    } catch {
      quotes.push(demoQuote(symbol));
    }
  }

  return quotes;
}
