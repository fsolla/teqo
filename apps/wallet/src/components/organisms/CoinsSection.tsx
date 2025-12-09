import { ChevronDown, ChevronUp, Loader2 } from "lucide-preact";
import { useMemo, useState } from "preact/hooks";
import { useCoins } from "../../hooks/useCoins";
import { useConvertCurrency } from "../../hooks/useExchangeRates";
import { formatCurrency } from "../../lib/formatCurrency";
import { getT } from "../../lib/i18n";
import { CoinGroupRow } from "../molecules/CoinGroupRow";

export const CoinsSection = () => {
  const { groupedCoins, totalUsd, hasData, isLoading, isFetching } = useCoins();
  const [showZeroValue, setShowZeroValue] = useState(false);
  const { convert, currency } = useConvertCurrency();

  const formattedTotal = formatCurrency(convert(totalUsd), currency);

  // Split grouped coins into those with value and those without
  const { coinsWithValue, coinsWithoutValue } = useMemo(() => {
    const withValue = groupedCoins.filter((group) => group.totalUsd > 0);
    const withoutValue = groupedCoins.filter((group) => group.totalUsd === 0);
    return { coinsWithValue: withValue, coinsWithoutValue: withoutValue };
  }, [groupedCoins]);

  // Show skeleton only if loading and no data available
  if (isLoading && !hasData) {
    return <CoinsSkeleton />;
  }

  const showLoadingIndicator = isFetching || isLoading;
  const hasZeroValueCoins = coinsWithoutValue.length > 0;

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

        {/* Coins with value */}
        <div className="flex flex-col">
          {coinsWithValue.map((group) => (
            <CoinGroupRow
              key={group.symbol}
              group={group}
              convertCurrency={convert}
              currency={currency}
            />
          ))}
        </div>

        {/* Separator for zero-value coins */}
        {hasZeroValueCoins && (
          <>
            <button
              type="button"
              onClick={() => setShowZeroValue(!showZeroValue)}
              className="flex items-center justify-center gap-2 w-full py-3 mt-2 text-teqo-400 text-sm"
            >
              <div className="flex-1 h-px bg-teqo-100" />
              <span className="flex items-center gap-1 px-2">
                {showZeroValue ? t("Hide") : t("Show")} {coinsWithoutValue.length}{" "}
                {coinsWithoutValue.length === 1
                  ? t("coin without value")
                  : t("coins without value")}
                {showZeroValue ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </span>
              <div className="flex-1 h-px bg-teqo-100" />
            </button>

            {/* Coins without value (collapsible) */}
            {showZeroValue && (
              <div className="flex flex-col">
                {coinsWithoutValue.map((group) => (
                  <CoinGroupRow
                    key={group.symbol}
                    group={group}
                    convertCurrency={convert}
                    currency={currency}
                  />
                ))}
              </div>
            )}
          </>
        )}
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
  Show: "Mostrar",
  Hide: "Ocultar",
  "coin without value": "moeda sem valor",
  "coins without value": "moedas sem valor",
});
