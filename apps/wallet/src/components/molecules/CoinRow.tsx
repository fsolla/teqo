import type { Coin } from "../../hooks/useCoins";

const NETWORK_ICONS = {
  ethereum: "/coins/ethereum.svg",
  arbitrum: "/coins/arbitrum.svg",
  solana: "/coins/solana.svg",
  bitcoin: "/coins/bitcoin.svg",
} as const;

export const CoinRow = ({ name, symbol, icon, balance, usd, network }: Coin) => {
  const formattedUsd = usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedBalance = balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });

  return (
    <article className="flex items-center gap-3 py-3">
      <div className="relative">
        {icon ? (
          <img src={icon} alt={name} className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-teqo-100 flex-center text-lg font-bold text-teqo-600">
            {symbol.slice(0, 2)}
          </div>
        )}
        {network && (
          <img
            src={NETWORK_ICONS[network]}
            alt={network}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white bg-white"
          />
        )}
      </div>
      <div className="flex-1">
        <h4>{name}</h4>
        <p className="text-sm text-teqo-400">{symbol}</p>
      </div>
      <div className="text-right">
        <h4>{formattedUsd}</h4>
        <p className="text-sm text-teqo-400">{formattedBalance}</p>
      </div>
    </article>
  );
};
