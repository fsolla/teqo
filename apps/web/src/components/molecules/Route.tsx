import clsx from "clsx";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import Link from "next/link";

export const Route = ({
  variant = "primary",
  href,
  icon,
  label,
  className,
}: {
  variant?: "primary" | "secondary" | "terciary";
  href: string;
  icon?: IconName;
  label: string;
  className?: string;
}) => (
  <Link
    href={href}
    className={clsx(
      "flex items-center rounded-2xl gap-4",
      variant === "terciary" ? "p-4" : "pl-9 pr-5 py-6.5",
      {
        primary: "bg-tint text-teko-50",
        secondary: "bg-teko-100 text-teko-900",
        terciary: "bg-teko-50 text-teko-600 border-teko-600 border",
      }[variant],
      className
    )}
  >
    {variant === "terciary" ? (
      <h5 className="flex-1 text-center">{label}</h5>
    ) : (
      <h4 className="flex-1">{label}</h4>
    )}
    {icon ? <DynamicIcon name={icon} size={30} /> : null}
  </Link>
);
