import { Loader2 } from "lucide-preact";
import { useCoins } from "../../hooks/useCoins";
import { getT } from "../../lib/i18n";
import { CoinRow } from "../molecules/CoinRow";

export const CoinsSection = () => {
  const { coins, totalUsd, hasData, isLoading, isFetching } = useCoins();

  const formattedTotal = totalUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Show skeleton only if loading and no data available
  if (isLoading && !hasData) {
    return <CoinsSkeleton />;
  }

  const showLoadingIndicator = isFetching || isLoading;

  return (
    <section className="flex flex-col">
      {/* Total Balance */}
      <div className="text-right mb-6">
        <h1 className="text-3xl font-bold">{formattedTotal}</h1>
      </div>

      {/* Coins List */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-teqo-400 text-sm font-medium">{t("Coins")}</h4>
          {showLoadingIndicator && (
            <Loader2 size={14} className="text-teqo-400 animate-spin" />
          )}
        </div>
        <div className="flex flex-col">
          {coins.map((coin) => (
            <CoinRow key={coin.id} {...coin} />
          ))}
        </div>
      </div>
    </section>
  );
};

const CoinsSkeleton = () => (
  <section className="flex flex-col animate-pulse">
    <div className="text-right mb-6">
      <div className="h-9 w-32 bg-teqo-100 rounded-lg ml-auto" />
    </div>
    <div>
      <div className="h-4 w-12 bg-teqo-100 rounded mb-2" />
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-12 h-12 rounded-full bg-teqo-100" />
            <div className="flex-1">
              <div className="h-4 w-20 bg-teqo-100 rounded mb-1" />
              <div className="h-3 w-10 bg-teqo-100 rounded" />
            </div>
            <div className="text-right">
              <div className="h-4 w-16 bg-teqo-100 rounded mb-1 ml-auto" />
              <div className="h-3 w-20 bg-teqo-100 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const t = getT({
  Coins: "Moedas",
});
