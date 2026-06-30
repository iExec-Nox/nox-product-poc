import { coingeckoIds, tokens } from "@/lib/tokens";
import { CONFIG } from "@/lib/config";

export async function GET() {
  try {
    const res = await fetch(
      `${CONFIG.urls.coingeckoApi}?ids=${coingeckoIds}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch prices" },
        { status: 502 }
      );
    }

    const data = await res.json();

    const prices: Record<string, number> = {};
    for (const token of tokens) {
      if (token.coingeckoId && data[token.coingeckoId]?.usd) {
        prices[token.symbol] = data[token.coingeckoId].usd;
      }
    }

    return Response.json(prices);
  } catch {
    return Response.json(
      { error: "Price service unavailable" },
      { status: 503 }
    );
  }
}
