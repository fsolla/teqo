"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const CodeSubmit = () => {
  const complete = useCreateAccountStore(
    (state) => state.emailCode.join("").length === 4
  );
  const router = useRouter();

  useEffect(() => {
    if (complete) {
      router.push("/welcome/create-account/name");
    }
  }, [complete, router]);

  return null;
};
