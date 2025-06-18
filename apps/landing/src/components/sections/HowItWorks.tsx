import { ShieldCheck } from "@/components/atoms/ShieldCheck";
import clsx from "clsx";
import type { ReactNode } from "react";

export const HowItWorks = () => (
  <section className="max-lg:px-5 flex flex-col gap-4">
    <h2 className="mb-2 lg:text-center lg:mb-6">
      How{" "}
      <span className="text-h1 bg-gradient-cyan-to-purple bg-clip-text text-transparent inline-block">
        Teqo
      </span>{" "}
      Works?
    </h2>
    <div className="flex flex-col gap-4 lg:grid grid-cols-3">
      <Item
        title="Create your account"
        description="Your private key is automatically protected."
        className="text-green-400"
      />
      <Item
        title="Manage with clarity"
        description={
          <>
            Organize your digital assets in a simple way.
            <br />
            Tokens, NFTs, domínios.
          </>
        }
        className="text-purple-400"
      />
      <Item
        title="Transact without fear"
        description="Each action is explained before it happens. Track progress in real time."
        className="text-blue-400"
      />
    </div>
    <div className="flex flex-col gap-3">
      <div className="pt-5 px-3 pb-2.5 bg-gradient-pink-to-purple rounded-2xl">
        <div className="flex max-md:flex-col gap-1 md:gap-6.5 bg-white rounded-2xl py-6 px-7.5 items-center">
          <div className="flex flex-col gap-1">
            <h4 className="bg-gradient-pink-to-purple bg-clip-text text-transparent inline-block">
              Assisted recovery by default
            </h4>
            <p className="text-gray-500">
              Unlike other wallets, you don’t need to worry about losing your
              keys. We protect everything securely so you always have access.
            </p>
          </div>
          <ShieldCheck className="max-md:mt-2 w-80" />
        </div>
      </div>
      <h6 className="px-10">
        <strong className="font-bold">For advanced users:</strong> You can
        disable this protection and use it in fully self-custodial mode whenever
        you want.
      </h6>
    </div>
  </section>
);

const Item = ({
  title,
  description,
  className,
}: {
  title: string;
  description: ReactNode;
  className: string;
}) => (
  <div className={clsx("px-10 py-6 border rounded-2xl lg:px-5", className)}>
    <h4>{title}</h4>
    <p className="text-gray-500">{description}</p>
  </div>
);
