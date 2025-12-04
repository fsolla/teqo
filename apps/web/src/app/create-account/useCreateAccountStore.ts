import { createSelectors } from "@/lib/createSelectors";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type EmailCode = [string | null, string | null, string | null, string | null];

interface CreateAccountStore {
  email: string | null;
  setEmail: (email: string | null) => void;
  emailCode: EmailCode;
  setEmailCode: (code: string | null, index: number) => void;
  emailConfirmed: boolean;
  setEmailConfirmed: (confirmed: boolean) => void;
  name: string | null;
  setName: (name: string) => void;
  pin: string | null;
  setPin: (pin: string) => void;
  pinConfirm: string | null;
  setPinConfirm: (pin: string) => void;
  pinConfirmed: boolean;
  setPinConfirmed: (confirmed: boolean) => void;
  reset: () => void;
}

const initialState = {
  email: null,
  emailCode: [null, null, null, null],
  emailConfirmed: false,
  name: null,
  pin: null,
  pinConfirm: null,
  pinConfirmed: false,
} satisfies Partial<CreateAccountStore>;

export const useCreateAccountStore = createSelectors(
  create<CreateAccountStore>()(
    devtools((set) => ({
      ...initialState,
      setEmail: (email) => set({ email }),
      setEmailCode: (code, index) =>
        set((state) => {
          const emailCode = [...state.emailCode] satisfies EmailCode;
          emailCode[index] = code;
          return { emailCode };
        }),
      setEmailConfirmed: (confirmed) => set({ emailConfirmed: confirmed }),
      setName: (name) => set({ name }),
      setPin: (pin) => set({ pin }),
      setPinConfirm: (pin) => set({ pinConfirm: pin }),
      setPinConfirmed: (confirmed) => set({ pinConfirmed: confirmed }),
      reset: () => set(initialState),
    }))
  )
);
