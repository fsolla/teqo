import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, formatEther, http } from "viem";
import { mainnet } from "viem/chains";
import { useAccountStore } from "../stores/useAccountStore";

// Ethereum client using public RPC
const ethClient = createPublicClient({
  chain: mainnet,
  transport: http("https://cloudflare-eth.com"),
});

// Solana connection
const solConnection = new Connection("https://api.mainnet-beta.solana.com");

// Fetch Ethereum balance
const fetchEthBalance = async (address: string): Promise<number> => {
  const balance = await ethClient.getBalance({
    address: address as `0x${string}`,
  });
  return Number(formatEther(balance));
};

// Fetch Solana balance
const fetchSolBalance = async (address: string): Promise<number> => {
  const publicKey = new PublicKey(address);
  const balance = await solConnection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
};

// Fetch Bitcoin balance from Blockstream API
const fetchBtcBalance = async (address: string): Promise<number> => {
  const response = await fetch(
    `https://blockstream.info/api/address/${address}`
  );
  const data = await response.json();
  // Balance is in satoshis, funded_txo_sum - spent_txo_sum
  const satoshis =
    data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
  return satoshis / 100_000_000; // Convert to BTC
};

export interface Balances {
  ethereum: number;
  solana: number;
  bitcoin: number;
}

export const useBalances = () => {
  const account = useAccountStore((state) => state.accounts[0]);

  const ethAddress = account?.ethereum[0];
  const solAddress = account?.solana[0];
  const btcAddress = account?.bitcoin[0];

  const ethQuery = useQuery({
    queryKey: ["balance", "ethereum", ethAddress],
    queryFn: () => fetchEthBalance(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });

  const solQuery = useQuery({
    queryKey: ["balance", "solana", solAddress],
    queryFn: () => fetchSolBalance(solAddress!),
    enabled: !!solAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const btcQuery = useQuery({
    queryKey: ["balance", "bitcoin", btcAddress],
    queryFn: () => fetchBtcBalance(btcAddress!),
    enabled: !!btcAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  return {
    balances: {
      ethereum: ethQuery.data ?? 0,
      solana: solQuery.data ?? 0,
      bitcoin: btcQuery.data ?? 0,
    },
    isLoading: ethQuery.isLoading || solQuery.isLoading || btcQuery.isLoading,
    isError: ethQuery.isError || solQuery.isError || btcQuery.isError,
  };
};
