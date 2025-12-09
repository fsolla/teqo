import { useQuery } from "@tanstack/react-query";

interface DeFiLlamaResponse {
  coins: {
    [key: string]: {
      price: number;
      symbol: string;
      decimals: number;
      timestamp: number;
      confidence: number;
    };
  };
}

export type TokenPrices = Record<string, number>;

export interface TokenPriceQuery {
  address: string;
  network: "ethereum" | "arbitrum" | "unichain" | "linea" | "base" | "solana";
}

const fetchTokenPrices = async (
  tokens: TokenPriceQuery[]
): Promise<TokenPrices> => {
  if (tokens.length === 0) return {};

  // Format addresses for DeFiLlama: {network}:{address}
  const coinIds = tokens.map((t) => `${t.network}:${t.address}`).join(",");

  const response = await fetch(
    `https://coins.llama.fi/prices/current/${coinIds}`
  );
  const data: DeFiLlamaResponse = await response.json();

  // Convert to a simple address -> price map
  const prices: TokenPrices = {};
  for (const token of tokens) {
    const key = `${token.network}:${token.address}`;
    prices[token.address] = data.coins[key]?.price ?? 0;
  }

  return prices;
};

export const useTokenPrices = (tokens: TokenPriceQuery[]) => {
  // Create a stable query key by sorting addresses
  const sortedKey = [...tokens]
    .sort((a, b) => a.address.localeCompare(b.address))
    .map((t) => `${t.network}:${t.address}`);

  return useQuery({
    queryKey: ["tokenPrices", ...sortedKey],
    queryFn: () => fetchTokenPrices(tokens),
    enabled: tokens.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
};
