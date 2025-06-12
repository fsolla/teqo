"use client";
import { PinPad } from "@/components/atoms/PinPad";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const Pad = ({
  value,
}: {
  value:
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "Backspace";
}) => (
  <PinPad
    set={useCreateAccountStore.use.setPin()}
    get={() => useCreateAccountStore.getState().pin ?? ""}
    value={value}
  />
);
