import clsx from "clsx";
import type { PropsWithChildren } from "preact/compat";

export const Page = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title?: string; description?: string }>) => (
  <main
    className={clsx(
      "bg-white h-full flex flex-col px-9 overflow-hidden",
      title && "pt-21 pb-17.5"
    )}
  >
    {title ? (
      <div className="flex flex-col gap-3.5 mb-10">
        <h2>{title}</h2>
        {description ? <p className="text-teqo-400">{description}</p> : null}
      </div>
    ) : null}
    {children}
  </main>
);
