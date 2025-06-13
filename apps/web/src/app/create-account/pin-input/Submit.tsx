"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const Submit = () => {
  const complete = useCreateAccountStore(
    (state) => state.pin && state.pin.length === 4
  );
  const router = useRouter();

  useEffect(() => {
    if (complete) {
      router.push("/welcome/create-account/pin-confirmation");
    }
  }, [complete, router]);

  return null;
};
