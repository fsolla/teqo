import clsx from "clsx";
import { ChevronLeft } from "lucide-preact";
import type { PropsWithChildren } from "preact/compat";
import { Link } from "wouter-preact";

export const Page = ({
  title,
  description,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
}>) => {
  const back = history.state?.back;

  return (
    <main
      className={clsx(
        "bg-white h-full flex flex-col px-9 overflow-hidden",
        title && "pt-21 pb-17.5"
      )}
    >
      {back ? (
        <Link href={back} className="absolute top-5 left-7">
          <ChevronLeft size={30} />
        </Link>
      ) : null}
      {title ? (
        <div className="flex flex-col gap-3.5 mb-10">
          <h2>{title}</h2>
          {description ? <p className="text-teqo-400">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </main>
  );
};
