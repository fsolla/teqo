import clsx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

export const InputView = ({
  title,
  description,
  children,
  className,
}: PropsWithChildren<{
  title: ReactNode;
  description: string;
  className?: string;
}>) => (
  <main
    className={clsx(
      "h-full pt-21 px-9 pb-17.5 flex flex-col gap-3.5",
      className
    )}
  >
    <h2>{title}</h2>
    <p className="text-teqo-400">{description}</p>
    {children}
  </main>
);
