import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, formatEther, http } from "viem";
import { arbitrum, linea, mainnet, unichain } from "viem/chains";
import { useAccountStore } from "../stores/useAccountStore";

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

// Ethereum client using Alchemy
const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

// Arbitrum client using Alchemy
const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

// Unichain client using Alchemy
const uniClient = createPublicClient({
  chain: unichain,
  transport: http(`https://unichain-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

// Linea client using Alchemy
const lineaClient = createPublicClient({
  chain: linea,
  transport: http(`https://linea-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

// Solana connection using Alchemy
const solConnection = new Connection(
  `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  "confirmed"
);

// Fetch Ethereum balance
const fetchEthBalance = async (address: string): Promise<number> => {
  const balance = await ethClient.getBalance({
    address: address as `0x${string}`,
  });
  return Number(formatEther(balance));
};

// Fetch Arbitrum ETH balance
const fetchArbEthBalance = async (address: string): Promise<number> => {
  const balance = await arbClient.getBalance({
    address: address as `0x${string}`,
  });
  return Number(formatEther(balance));
};

// Fetch Unichain ETH balance
const fetchUniEthBalance = async (address: string): Promise<number> => {
  const balance = await uniClient.getBalance({
    address: address as `0x${string}`,
  });
  return Number(formatEther(balance));
};

// Fetch Linea ETH balance
const fetchLineaEthBalance = async (address: string): Promise<number> => {
  const balance = await lineaClient.getBalance({
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
  arbitrum: number;
  unichain: number;
  linea: number;
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

  const arbQuery = useQuery({
    queryKey: ["balance", "arbitrum", ethAddress],
    queryFn: () => fetchArbEthBalance(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const uniQuery = useQuery({
    queryKey: ["balance", "unichain", ethAddress],
    queryFn: () => fetchUniEthBalance(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const lineaQuery = useQuery({
    queryKey: ["balance", "linea", ethAddress],
    queryFn: () => fetchLineaEthBalance(ethAddress!),
    enabled: !!ethAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
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
      arbitrum: arbQuery.data ?? 0,
      unichain: uniQuery.data ?? 0,
      linea: lineaQuery.data ?? 0,
      solana: solQuery.data ?? 0,
      bitcoin: btcQuery.data ?? 0,
    },
    isLoading:
      ethQuery.isLoading ||
      arbQuery.isLoading ||
      uniQuery.isLoading ||
      lineaQuery.isLoading ||
      solQuery.isLoading ||
      btcQuery.isLoading,
    isError:
      ethQuery.isError ||
      arbQuery.isError ||
      uniQuery.isError ||
      lineaQuery.isError ||
      solQuery.isError ||
      btcQuery.isError,
  };
};
