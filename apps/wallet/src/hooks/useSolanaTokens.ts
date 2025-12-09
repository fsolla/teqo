import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { useAccountStore } from "../stores/useAccountStore";

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY;
const ALCHEMY_SOLANA_URL = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Solana connection using Alchemy
const connection = new Connection(ALCHEMY_SOLANA_URL, "confirmed");

export interface SolanaTokenBalance {
  mint: string;
  balance: number;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

// Jupiter V2 API response format
interface JupiterTokenV2 {
  id: string; // mint address
  name: string;
  symbol: string;
  decimals: number;
  icon: string | null; // logo URL
}

// Fetch metadata for multiple tokens using Jupiter's Tokens API V2
const fetchTokensMetadata = async (
  mints: string[]
): Promise<Map<string, JupiterTokenV2>> => {
  if (mints.length === 0) return new Map();

  try {
    // Jupiter allows up to 100 mints per query, comma-separated
    const query = mints.join(",");
    const response = await fetch(
      `https://api.jup.ag/tokens/v2/search?query=${query}`,
      {
        headers: {
          "x-api-key": JUPITER_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const tokens: JupiterTokenV2[] = await response.json();

    // Map by 'id' which is the mint address in V2 API
    return new Map(tokens.map((t) => [t.id, t]));
  } catch (error) {
    console.warn("[SPL] Failed to fetch token metadata from Jupiter:", error);
    return new Map();
  }
};

// Fetch all Solana token data
const fetchSolanaTokens = async (
  ownerAddress: string
): Promise<SolanaTokenBalance[]> => {
  const owner = new PublicKey(ownerAddress);

  // Fetch all token accounts owned by this wallet
  const response = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  // Filter out zero balances and collect mints
  const nonZeroAccounts = response.value.filter((item) => {
    const amount = item.account.data.parsed.info.tokenAmount.uiAmount;
    return amount && amount > 0;
  });

  // Get all mint addresses
  const mints = nonZeroAccounts.map(
    (item) => item.account.data.parsed.info.mint
  );

  // Fetch metadata for all tokens using Jupiter
  const metadataMap = await fetchTokensMetadata(mints);

  // Map to our format
  const tokens: SolanaTokenBalance[] = nonZeroAccounts.map(({ account }) => {
    const info = account.data.parsed.info;
    const mint = info.mint;
    const amount = info.tokenAmount.uiAmount;
    const decimals = info.tokenAmount.decimals;

    const token = metadataMap.get(mint);

    return {
      mint,
      balance: amount,
      name: token?.name || "Unknown Token",
      symbol: token?.symbol || "???",
      decimals,
      logo: token?.icon || null, // V2 uses 'icon' not 'logoURI'
    };
  });

  return tokens;
};

export const useSolanaTokens = () => {
  const account = useAccountStore((state) => state.accounts[0]);
  const solAddress = account?.solana[0];

  return useQuery({
    queryKey: ["solanaTokens", solAddress],
    queryFn: () => fetchSolanaTokens(solAddress!),
    enabled: !!solAddress,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
};
