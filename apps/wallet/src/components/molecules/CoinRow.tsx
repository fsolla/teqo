import type { Coin } from "../../hooks/useCoins";

export const CoinRow = ({ name, symbol, icon, balance, usd }: Coin) => {
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
      <img src={icon} alt={name} className="w-12 h-12" />
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
