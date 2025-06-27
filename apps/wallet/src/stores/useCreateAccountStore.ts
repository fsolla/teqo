import { create } from "zustand";
import { createSelectors } from "./createSelectors";

interface CreateAccountStore {
  email?: string;
  setEmail: (email: string) => void;
}

export const useCreateAccountStore = createSelectors(
  create<CreateAccountStore>()((set) => ({
    email: undefined,
    setEmail: (email: string) => set({ email }),
  }))
);
