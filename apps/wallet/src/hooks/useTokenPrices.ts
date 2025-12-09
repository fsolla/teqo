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

const fetchTokenPrices = async (
  tokenAddresses: string[]
): Promise<TokenPrices> => {
  if (tokenAddresses.length === 0) return {};

  // Format addresses for DeFiLlama: ethereum:{address}
  const coinIds = tokenAddresses.map((addr) => `ethereum:${addr}`).join(",");

  const response = await fetch(
    `https://coins.llama.fi/prices/current/${coinIds}`
  );
  const data: DeFiLlamaResponse = await response.json();

  // Convert to a simple address -> price map
  const prices: TokenPrices = {};
  for (const address of tokenAddresses) {
    const key = `ethereum:${address}`;
    prices[address] = data.coins[key]?.price ?? 0;
  }

  return prices;
};

export const useTokenPrices = (tokenAddresses: string[]) => {
  return useQuery({
    queryKey: ["tokenPrices", ...tokenAddresses.sort()],
    queryFn: () => fetchTokenPrices(tokenAddresses),
    enabled: tokenAddresses.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
};
