import { useMemo } from "preact/hooks";
import { useBalances } from "./useBalances";
import { useCoinPrices } from "./useCoinPrices";
import { useEthereumTokens } from "./useEthereumTokens";
import { useTokenPrices } from "./useTokenPrices";

export interface Coin {
  id: string;
  name: string;
  symbol: string;
  icon: string | null;
  balance: number;
  usd: number;
}

const NATIVE_COIN_CONFIG = {
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
    data: nativePrices,
    isLoading: nativePricesLoading,
    isFetching: nativePricesFetching,
  } = useCoinPrices();

  // Fetch ERC-20 tokens
  const {
    data: ethereumTokens,
    isLoading: tokensLoading,
    isFetching: tokensFetching,
  } = useEthereumTokens();

  // Get token addresses for price fetching
  const tokenAddresses = useMemo(
    () => ethereumTokens?.map((t) => t.contractAddress) ?? [],
    [ethereumTokens]
  );

  // Fetch prices for ERC-20 tokens
  const { data: tokenPrices, isLoading: tokenPricesLoading } =
    useTokenPrices(tokenAddresses);

  const coins = useMemo(() => {
    const coinList: Coin[] = [];

    // Add native coins
    if (nativePrices) {
      (["ethereum", "solana", "bitcoin"] as const).forEach((id) => {
        if (balances[id] > 0) {
          coinList.push({
            id,
            ...NATIVE_COIN_CONFIG[id],
            balance: balances[id],
            usd: balances[id] * (nativePrices[id] ?? 0),
          });
        }
      });
    }

    // Add ERC-20 tokens
    if (ethereumTokens && tokenPrices) {
      ethereumTokens.forEach((token) => {
        const price = tokenPrices[token.contractAddress] ?? 0;
        coinList.push({
          id: token.contractAddress,
          name: token.name,
          symbol: token.symbol,
          icon: token.logo,
          balance: token.balance,
          usd: token.balance * price,
        });
      });
    }

    // Sort by USD value (highest first)
    return coinList.sort((a, b) => b.usd - a.usd);
  }, [balances, nativePrices, ethereumTokens, tokenPrices]);

  const totalUsd = useMemo(
    () => coins.reduce((sum, coin) => sum + coin.usd, 0),
    [coins]
  );

  const hasCoins = totalUsd > 0 || coins.length > 0;
  const hasData = nativePrices !== undefined;
  const isLoading =
    balancesLoading || nativePricesLoading || tokensLoading || tokenPricesLoading;
  const isFetching = nativePricesFetching || tokensFetching;

  return {
    coins,
    totalUsd,
    hasCoins,
    hasData,
    isLoading,
    isFetching,
  };
};
