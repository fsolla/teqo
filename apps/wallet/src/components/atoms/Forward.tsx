import clsx from "clsx";
import { ArrowRight } from "lucide-preact";
import type { MouseEvent, MouseEventHandler } from "preact/compat";
import { Link } from "wouter-preact";

export const Forward = ({
  href,
  className,
  disabled,
  onClick,
}: {
  href?: string;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) => {
  const aggregateClassName = clsx(
    "text-teqo-50 rounded-full p-2 flex-center aspect-square size-fit",
    disabled ? "bg-teqo-300" : "bg-tint",
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        className={aggregateClassName}
        aria-disabled={disabled}
        onClick={disabled ? disableOnClick : undefined}
      >
        <ArrowRight size={24} />
      </Link>
    );
  }

  return (
    <button
      className={aggregateClassName}
      disabled={disabled}
      onClick={onClick}
    >
      <ArrowRight size={24} />
    </button>
  );
};

function disableOnClick<Element extends EventTarget>(e: MouseEvent<Element>) {
  e.preventDefault();
  e.stopPropagation();
}
