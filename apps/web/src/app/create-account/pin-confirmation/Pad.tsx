"use client";
import { PinPad, type PinPadValue } from "@/components/atoms/PinPad";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const Pad = ({ value }: { value: PinPadValue }) => (
  <PinPad
    set={useCreateAccountStore.use.setPinConfirm()}
    get={() => useCreateAccountStore.getState().pinConfirm ?? ""}
    value={value}
  />
);
