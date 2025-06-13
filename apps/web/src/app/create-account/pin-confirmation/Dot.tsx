"use client";
import { PinDot } from "@/components/atoms/PinDot";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const Dot = ({ index }: { index: number }) => (
  <PinDot
    filled={useCreateAccountStore(
      (state) => !!(state.pinConfirm && state.pinConfirm.length > index)
    )}
  />
);
