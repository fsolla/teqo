import { useQuery } from "@tanstack/react-query";

interface DeFiLlamaResponse {
  coins: {
    [key: string]: {
      price: number;
      symbol: string;
      timestamp: number;
      confidence: number;
    };
  };
}

export interface CoinPrices {
  ethereum: number;
  solana: number;
  bitcoin: number;
}

const COIN_IDS = [
  "coingecko:ethereum",
  "coingecko:solana",
  "coingecko:bitcoin",
].join(",");

const fetchCoinPrices = async (): Promise<CoinPrices> => {
  const response = await fetch(
    `https://coins.llama.fi/prices/current/${COIN_IDS}`
  );
  const data: DeFiLlamaResponse = await response.json();

  return {
    ethereum: data.coins["coingecko:ethereum"]?.price ?? 0,
    solana: data.coins["coingecko:solana"]?.price ?? 0,
    bitcoin: data.coins["coingecko:bitcoin"]?.price ?? 0,
  };
};

export const useCoinPrices = () => {
  return useQuery({
    queryKey: ["coinPrices"],
    queryFn: fetchCoinPrices,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
};
