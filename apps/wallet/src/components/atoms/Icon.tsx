import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export const Icon = ({
  name,
  size,
  className,
}: {
  name: IconName;
  size: "sm" | "md" | "lg";
  className?: string;
}) => <DynamicIcon name={name} size={Sizes[size]} className={className} />;

const Sizes = {
  sm: 16,
  md: 24,
  lg: 30,
} as const;
