"use client";
import { Forward } from "@/components/atoms/Forward";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const NameSubmit = ({ className }: { className?: string }) => {
  const disabled = useCreateAccountStore((state) => !state.name?.length);

  return (
    <Forward
      href="/welcome/create-account/pin-input"
      disabled={disabled}
      className={className}
    />
  );
};
