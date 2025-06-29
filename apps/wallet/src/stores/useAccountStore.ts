import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "./createSelectors";

interface Account {
  name: string;
}

interface AccountStore {
  accounts: Account[];
  createAccount: (name: string, pin: string) => void;
}

export const useAccountStore = createSelectors(
  create<AccountStore>()(
    persist(
      (set) => ({
        accounts: [] as Account[],
        createAccount: (name: string, pin: string) => {
          set((state) => ({
            accounts: [...state.accounts, { name }],
          }));
        },
      }),
      { name: "account-store" }
    )
  )
);
