import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "./createSelectors";

interface Account {
  name: string;
}

interface AccountStore {
  accounts: Account[];
}

export const useAccountStore = createSelectors(
  create<AccountStore>()(
    persist(
      () => ({
        accounts: [] as Account[],
      }),
      { name: "account-store" }
    )
  )
);
