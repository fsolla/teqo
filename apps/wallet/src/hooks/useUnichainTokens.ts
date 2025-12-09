import { useQuery } from "@tanstack/react-query";
import { createPublicClient, erc20Abi, http } from "viem";
import { unichain } from "viem/chains";
import { useAccountStore } from "../stores/useAccountStore";

// Unichain client using public RPC
const uniClient = createPublicClient({
  chain: unichain,
  transport: http("https://mainnet.unichain.org"),
});

export interface UnichainTokenBalance {
  contractAddress: string;
  balance: number;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

// Known tokens on Unichain with their logos
// We'll expand this list as more tokens become available
const KNOWN_TOKENS: Record<
  string,
  { name: string; symbol: string; decimals: number; logo: string | null }
> = {
  // USDC on Unichain
  "0x078d782b760474a361dda0af3839290b0ef57ad6": {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  },
  // WETH on Unichain
  "0x4200000000000000000000000000000000000006": {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  },
};

// Fetch balance for a single token
const fetchTokenBalance = async (
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`
): Promise<bigint> => {
  try {
    const balance = await uniClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [ownerAddress],
    });
    return balance;
  } catch {
    return 0n;
  }
};

// Fetch all Unichain token data
const fetchUnichainTokens = async (
  address: string
): Promise<UnichainTokenBalance[]> => {
  const ownerAddress = address as `0x${string}`;
  const tokens: UnichainTokenBalance[] = [];

  // Check known tokens for balances
  for (const [contractAddress, tokenInfo] of Object.entries(KNOWN_TOKENS)) {
    const balance = await fetchTokenBalance(
      contractAddress as `0x${string}`,
      ownerAddress
    );

    if (balance > 0n) {
      tokens.push({
        contractAddress: contractAddress.toLowerCase(),
        balance: Number(balance) / 10 ** tokenInfo.decimals,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        logo: tokenInfo.logo,
      });
    }
  }

  return tokens;
};

export const useUnichainTokens = () => {
  const account = useAccountStore((state) => state.accounts[0]);
  const ethAddress = account?.ethereum[0]; // Same address as Ethereum

  return useQuery({
    queryKey: ["unichainTokens", ethAddress],
    queryFn: () => fetchUnichainTokens(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
};

