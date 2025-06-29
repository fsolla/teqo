import clsx from "clsx";

export const PinDots = ({
  size,
  isFilled,
}: {
  size: number;
  isFilled: (index: number) => boolean;
}) => (
  <div className="flex gap-4 w-fit self-center mb-12 mt-19.5">
    {Array.from({ length: size }, (_, index) => (
      <div
        key={`pin-dot-${index}`}
        className={clsx(
          "size-2 rounded-full",
          isFilled(index) ? "bg-teqo-900" : "bg-teqo-100"
        )}
      />
    ))}
  </div>
);
