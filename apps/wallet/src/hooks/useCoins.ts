import { useMemo } from "preact/hooks";
import { useArbitrumTokens } from "./useArbitrumTokens";
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
  network: "ethereum" | "arbitrum" | "solana" | "bitcoin" | null;
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

  // Fetch ERC-20 tokens (Ethereum)
  const {
    data: ethereumTokens,
    isLoading: ethTokensLoading,
    isFetching: ethTokensFetching,
  } = useEthereumTokens();

  // Fetch ERC-20 tokens (Arbitrum)
  const {
    data: arbitrumTokens,
    isLoading: arbTokensLoading,
    isFetching: arbTokensFetching,
  } = useArbitrumTokens();

  // Fetch SPL tokens (Solana)
  const {
    data: solanaTokens,
    isLoading: solTokensLoading,
    isFetching: solTokensFetching,
  } = useSolanaTokens();

  // Build token price queries for all networks
  const tokenPriceQueries = useMemo<TokenPriceQuery[]>(() => {
    const queries: TokenPriceQuery[] = [];

    if (ethereumTokens) {
      ethereumTokens.forEach((t) =>
        queries.push({ address: t.contractAddress, network: "ethereum" })
      );
    }

    if (arbitrumTokens) {
      arbitrumTokens.forEach((t) =>
        queries.push({ address: t.contractAddress, network: "arbitrum" })
      );
    }

    if (solanaTokens) {
      solanaTokens.forEach((t) =>
        queries.push({ address: t.mint, network: "solana" })
      );
    }

    return queries;
  }, [ethereumTokens, arbitrumTokens, solanaTokens]);

  // Fetch prices for all tokens
  const { data: tokenPrices, isLoading: tokenPricesLoading } =
    useTokenPrices(tokenPriceQueries);

  const coins = useMemo(() => {
    const coinList: Coin[] = [];

    // Add native coins (Ethereum, Solana, Bitcoin)
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

      // Add Arbitrum ETH (same price as Ethereum)
      if (balances.arbitrum > 0) {
        coinList.push({
          id: "arbitrum-eth",
          name: "Ethereum",
          symbol: "ETH",
          icon: "/coins/ethereum.svg",
          balance: balances.arbitrum,
          usd: balances.arbitrum * (nativePrices.ethereum ?? 0),
          network: "arbitrum", // Show Arbitrum badge
        });
      }
    }

    // Add ERC-20 tokens (Ethereum)
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

    // Add ERC-20 tokens (Arbitrum)
    if (arbitrumTokens && tokenPrices) {
      arbitrumTokens.forEach((token) => {
        const price = tokenPrices[token.contractAddress] ?? 0;
        coinList.push({
          id: `arb:${token.contractAddress}`,
          name: token.name,
          symbol: token.symbol,
          icon: token.logo,
          balance: token.balance,
          usd: token.balance * price,
          network: "arbitrum",
        });
      });
    }

    // Add SPL tokens (Solana)
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
  }, [
    balances,
    nativePrices,
    ethereumTokens,
    arbitrumTokens,
    solanaTokens,
    tokenPrices,
  ]);

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
    arbTokensLoading ||
    solTokensLoading ||
    tokenPricesLoading;
  const isFetching =
    nativePricesFetching ||
    ethTokensFetching ||
    arbTokensFetching ||
    solTokensFetching;

  return {
    coins,
    totalUsd,
    hasCoins,
    hasData,
    isLoading,
    isFetching,
  };
};
