"use client";
import { Forward } from "@/components/atoms/Forward";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const EmailSubmit = ({ className }: { className?: string }) => {
  const disabled = useCreateAccountStore((state) => !state.email);

  return (
    <Forward
      href="/welcome/create-account/email-confirmation"
      disabled={disabled}
      className={className}
    />
  );
};
