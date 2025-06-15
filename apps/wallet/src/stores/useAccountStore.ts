import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "./createSelectors";

interface Account {}

interface AccountStore {
  accounts: Account[];
}

export const useAccountStore = createSelectors(
  create<AccountStore>()(
    persist(
      (set, get) => ({
        accounts: [],
      }),
      { name: "account-store" }
    )
  )
);
