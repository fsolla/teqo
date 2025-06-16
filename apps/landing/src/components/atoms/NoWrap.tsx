import type { PropsWithChildren } from "react";

export const NoWrap = ({ children }: PropsWithChildren) => (
  <span className="whitespace-nowrap">{children}</span>
);
