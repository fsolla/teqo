"use client";
import { useAccountStore } from "@/features/accounts/hooks/useAccountStore";
import { redirect } from "next/navigation";

export default function Home() {
  const account = useAccountStore.use.current();

  if (account) {
    return redirect("/main");
  } else {
    return redirect("/welcome/0");
  }
}
