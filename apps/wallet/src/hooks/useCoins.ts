import { useMemo } from "preact/hooks";
import { useBalances } from "./useBalances";
import { useCoinPrices } from "./useCoinPrices";
import { useEthereumTokens } from "./useEthereumTokens";
import { useSolanaTokens } from "./useSolanaTokens";
import { useTokenPrices, type TokenPriceQuery } from "./useTokenPrices";

export interface Coin {
  id: string;
  name: string;
  symbol: string;
  icon: string | null;
  balance: number;
  usd: number;
  network: "ethereum" | "solana" | "bitcoin" | null;
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
    isLoading: ethTokensLoading,
    isFetching: ethTokensFetching,
  } = useEthereumTokens();

  // Fetch SPL tokens
  const {
    data: solanaTokens,
    isLoading: solTokensLoading,
    isFetching: solTokensFetching,
  } = useSolanaTokens();

  // Build token price queries for both networks
  const tokenPriceQueries = useMemo<TokenPriceQuery[]>(() => {
    const queries: TokenPriceQuery[] = [];

    if (ethereumTokens) {
      ethereumTokens.forEach((t) =>
        queries.push({ address: t.contractAddress, network: "ethereum" })
      );
    }

    if (solanaTokens) {
      solanaTokens.forEach((t) =>
        queries.push({ address: t.mint, network: "solana" })
      );
    }

    return queries;
  }, [ethereumTokens, solanaTokens]);

  // Fetch prices for all tokens
  const { data: tokenPrices, isLoading: tokenPricesLoading } =
    useTokenPrices(tokenPriceQueries);

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
            network: null, // Native coins don't show network badge
          });
        }
      });
    }

    // Add ERC-20 tokens
    if (ethereumTokens && tokenPrices) {
      ethereumTokens.forEach((token) => {
        const price = tokenPrices[token.contractAddress] ?? 0;
        coinList.push({
          id: `eth:${token.contractAddress}`,
          name: token.name,
          symbol: token.symbol,
          icon: token.logo,
          balance: token.balance,
          usd: token.balance * price,
          network: "ethereum",
        });
      });
    }

    // Add SPL tokens
    if (solanaTokens && tokenPrices) {
      solanaTokens.forEach((token) => {
        const price = tokenPrices[token.mint] ?? 0;
        coinList.push({
          id: `sol:${token.mint}`,
          name: token.name,
          symbol: token.symbol,
          icon: token.logo,
          balance: token.balance,
          usd: token.balance * price,
          network: "solana",
        });
      });
    }

    // Sort by USD value (highest first)
    return coinList.sort((a, b) => b.usd - a.usd);
  }, [balances, nativePrices, ethereumTokens, solanaTokens, tokenPrices]);

  const totalUsd = useMemo(
    () => coins.reduce((sum, coin) => sum + coin.usd, 0),
    [coins]
  );

  const hasCoins = totalUsd > 0 || coins.length > 0;
  const hasData = nativePrices !== undefined;
  const isLoading =
    balancesLoading ||
    nativePricesLoading ||
    ethTokensLoading ||
    solTokensLoading ||
    tokenPricesLoading;
  const isFetching =
    nativePricesFetching || ethTokensFetching || solTokensFetching;

  return {
    coins,
    totalUsd,
    hasCoins,
    hasData,
    isLoading,
    isFetching,
  };
};
