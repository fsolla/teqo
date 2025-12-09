import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "./createSelectors";

export type Currency = "USD" | "EUR" | "GBP" | "BRL" | "JPY" | "CNY" | "AUD" | "CAD";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

interface SettingsState {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const useSettingsStoreBase = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "USD",
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "teqo-settings",
    }
  )
);

export const useSettingsStore = createSelectors(useSettingsStoreBase);

// Helper to get currency config
export const getCurrencyConfig = (code: Currency): CurrencyConfig => {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
};

