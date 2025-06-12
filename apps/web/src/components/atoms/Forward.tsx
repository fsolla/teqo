import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

export const Forward = ({
  href,
  className,
  disabled,
}: {
  href: string;
  className?: string;
  disabled?: boolean;
}) => (
  <Link
    href={href}
    className={clsx(
      "text-teko-50 rounded-full p-2 flex-center aspect-square size-fit",
      disabled ? "bg-teko-300" : "bg-tint",
      className
    )}
    aria-disabled={disabled}
    onClick={disabled ? disableOnClick : undefined}
  >
    <ArrowRight size={24} />
  </Link>
);

function disableOnClick<Element>(e: MouseEvent<Element>) {
  e.preventDefault();
  e.stopPropagation();
}
