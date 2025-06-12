import type { ComponentType } from "react";

export const PinDotRow = ({
  dot: Dot,
}: {
  dot: ComponentType<{ index: number }>;
}) => (
  <div className="flex gap-4 w-fit self-center mb-12 mt-19.5">
    <Dot index={0} />
    <Dot index={1} />
    <Dot index={2} />
    <Dot index={3} />
  </div>
);
