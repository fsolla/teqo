import type { Currency } from "../stores/useSettingsStore";

export const formatCurrency = (
  amount: number,
  currency: Currency,
  options?: { compact?: boolean }
): string => {
  const { compact = false } = options ?? {};

  // For JPY and CNY, we don't show decimals
  const noDecimalCurrencies: Currency[] = ["JPY", "CNY"];
  const minimumFractionDigits = noDecimalCurrencies.includes(currency) ? 0 : 2;
  const maximumFractionDigits = noDecimalCurrencies.includes(currency) ? 0 : 2;

  if (compact && amount >= 1000) {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

