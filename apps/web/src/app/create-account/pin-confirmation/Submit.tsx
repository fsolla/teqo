"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const Submit = () => {
  const complete = useCreateAccountStore(
    (state) => state.pinConfirm && state.pinConfirm.length === 4
  );
  const router = useRouter();

  useEffect(() => {
    const pin = useCreateAccountStore.getState().pin;
    const pinConfirm = useCreateAccountStore.getState().pinConfirm;

    if (complete) {
      if (pin && pinConfirm && pin === pinConfirm) {
        router.push("/main");
      } else {
        useCreateAccountStore.setState({ pinConfirm: "", pin: "" });
        router.push("/welcome/create-account/pin-input");
      }
    }
  }, [complete, router]);

  return null;
};
