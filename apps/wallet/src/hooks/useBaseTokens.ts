import { useQuery } from "@tanstack/react-query";
import { useAccountStore } from "../stores/useAccountStore";

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

export interface BaseTokenBalance {
  contractAddress: string;
  balance: number;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface AlchemyTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

// Fetch token balances from Alchemy Base
const fetchTokenBalances = async (
  address: string
): Promise<AlchemyTokenBalance[]> => {
  const response = await fetch(ALCHEMY_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "alchemy_getTokenBalances",
      params: [address, "erc20"],
      id: 1,
    }),
  });

  const data = await response.json();
  return data.result?.tokenBalances ?? [];
};

// Fetch token metadata from Alchemy Base
const fetchTokenMetadata = async (
  contractAddress: string
): Promise<AlchemyTokenMetadata> => {
  const response = await fetch(ALCHEMY_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "alchemy_getTokenMetadata",
      params: [contractAddress],
      id: 1,
    }),
  });

  const data = await response.json();
  return data.result;
};

// Fetch all Base token data (balances + metadata)
const fetchBaseTokens = async (
  address: string
): Promise<BaseTokenBalance[]> => {
  const tokenBalances = await fetchTokenBalances(address);

  // Filter out zero balances
  const nonZeroBalances = tokenBalances.filter(
    (t) => t.tokenBalance && BigInt(t.tokenBalance) > 0n
  );

  // Fetch metadata for each token
  const tokensWithMetadata = await Promise.all(
    nonZeroBalances.map(async (token) => {
      const metadata = await fetchTokenMetadata(token.contractAddress);
      const rawBalance = BigInt(token.tokenBalance);
      const balance = Number(rawBalance) / 10 ** (metadata.decimals || 18);

      return {
        contractAddress: token.contractAddress.toLowerCase(),
        balance,
        name: metadata.name || "Unknown",
        symbol: metadata.symbol || "???",
        decimals: metadata.decimals || 18,
        logo: metadata.logo,
      };
    })
  );

  return tokensWithMetadata;
};

export const useBaseTokens = () => {
  const account = useAccountStore((state) => state.accounts[0]);
  const ethAddress = account?.ethereum[0]; // Same address as Ethereum

  return useQuery({
    queryKey: ["baseTokens", ethAddress],
    queryFn: () => fetchBaseTokens(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
};
