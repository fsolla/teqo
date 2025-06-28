import { create } from "zustand";
import { createSelectors } from "./createSelectors";

interface CreateAccountStore {
  email: string;
  setEmail: (email: string) => void;
}

const initialState = {
  email: "",
} satisfies Partial<CreateAccountStore>;

export const useCreateAccountStore = createSelectors(
  create<CreateAccountStore>()((set) => ({
    ...initialState,
    setEmail: (email: string) => set({ email }),
    reset: () => set(initialState),
  }))
);
