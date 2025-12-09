import { useQuery } from "@tanstack/react-query";
import { type Currency, useSettingsStore } from "../stores/useSettingsStore";

// Exchange rates relative to USD
type ExchangeRates = Record<Currency, number>;

// Free API for exchange rates
const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  // Using exchangerate-api.com free tier (updates daily)
  const response = await fetch(
    "https://api.exchangerate-api.com/v4/latest/USD"
  );
  const data = await response.json();

  return {
    USD: 1,
    EUR: data.rates.EUR ?? 1,
    GBP: data.rates.GBP ?? 1,
    BRL: data.rates.BRL ?? 1,
    JPY: data.rates.JPY ?? 1,
    CNY: data.rates.CNY ?? 1,
    AUD: data.rates.AUD ?? 1,
    CAD: data.rates.CAD ?? 1,
  };
};

export const useExchangeRates = () => {
  return useQuery({
    queryKey: ["exchangeRates"],
    queryFn: fetchExchangeRates,
    staleTime: 60 * 60_000, // 1 hour (rates don't change frequently)
    gcTime: 24 * 60 * 60_000, // 24 hours
  });
};

// Hook to convert USD to user's selected currency
export const useConvertCurrency = () => {
  const currency = useSettingsStore((state) => state.currency);
  const { data: rates } = useExchangeRates();

  const convert = (usdAmount: number): number => {
    if (!rates) return usdAmount;
    return usdAmount * rates[currency];
  };

  return { convert, currency, rates };
};

