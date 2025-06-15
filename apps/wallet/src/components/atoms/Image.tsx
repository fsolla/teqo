import clsx from "clsx";

export const Image = ({
  src,
  size,
  alt,
  className,
}: {
  src: string;
  size: "xs" | "sm" | "md" | "lg";
  alt: string;
  className?: string;
}) => (
  <img
    src={src}
    alt={alt}
    className={clsx("aspect-square", Sizes[size], className)}
  />
);

const Sizes = {
  xs: "w-3",
  sm: "w-6",
  md: "w-7.5",
  lg: "w-9",
} as const;
