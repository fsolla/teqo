import clsx from "clsx";

export const PinDot = ({ filled }: { filled: boolean }) => (
  <div
    className={clsx(
      "size-2 rounded-full",
      filled ? "bg-teqo-900" : "bg-teqo-100"
    )}
  />
);
