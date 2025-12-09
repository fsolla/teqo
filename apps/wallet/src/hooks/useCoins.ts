import { useMemo } from "preact/hooks";
import { useBalances } from "./useBalances";
import { useCoinPrices } from "./useCoinPrices";

export interface Coin {
  id: "ethereum" | "solana" | "bitcoin";
  name: string;
  symbol: string;
  icon: string;
  balance: number;
  usd: number;
}

const COIN_CONFIG = {
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    icon: "/coins/ethereum.svg",
  },
  solana: {
    name: "Solana",
    symbol: "SOL",
    icon: "/coins/solana.svg",
  },
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    icon: "/coins/bitcoin.svg",
  },
} as const;

export const useCoins = () => {
  const { balances, isLoading: balancesLoading } = useBalances();
  const {
    data: prices,
    isLoading: pricesLoading,
    isFetching: pricesFetching,
  } = useCoinPrices();

  const coins = useMemo(() => {
    if (!prices) return [];

    const coinList: Coin[] = (["ethereum", "solana", "bitcoin"] as const).map(
      (id) => ({
        id,
        ...COIN_CONFIG[id],
        balance: balances[id],
        usd: balances[id] * (prices[id] ?? 0),
      })
    );

    // Filter to only show coins with balance, sort by USD value (highest first)
    return coinList.filter((coin) => coin.balance > 0).sort((a, b) => b.usd - a.usd);
  }, [balances, prices]);

  const totalUsd = useMemo(
    () => coins.reduce((sum, coin) => sum + coin.usd, 0),
    [coins]
  );

  const hasCoins = totalUsd > 0;
  const hasData = coins.length > 0;
  const isLoading = balancesLoading || pricesLoading;
  const isFetching = pricesFetching;

  return {
    coins,
    totalUsd,
    hasCoins,
    hasData,
    isLoading,
    isFetching,
  };
};
