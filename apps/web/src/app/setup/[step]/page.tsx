import { ChevronRight } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Url } from "next/dist/shared/lib/router/router";
import Link from "next/link";
import { redirect } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ step: "0" | "1" }>;
}) {
  const { step } = use(params);

  if (!["0", "1"].includes(step)) {
    redirect("/setup/0");
  }

  return (
    <main className="h-full text-left p-5 flex flex-col justify-end py-22.5 gap-8">
      {step === "1" ? (
        <>
          <Option
            href="/account/add/watch"
            icon="eye"
            title="Watch a wallet"
            description="Track a single-chain public wallet address"
          />
          <Option
            href="/account/add/hardware"
            icon="hard-drive-upload"
            title="Connect hardware wallet"
            description="Connect your hardware wallet to Teko"
          />
          <Option
            href="/account/add/connect"
            icon="scan-qr-code"
            title="Connect your wallet"
            description="Connect through a wallet provider"
          />
          <Option
            href="/account/add/key/network"
            icon="key-round"
            title="Import private key"
            description="Import a single-chain account using a private key"
          />
        </>
      ) : null}
      <Option
        href="/account/add/create/intro"
        icon="plus"
        title="Create your new account"
        description="Create your new multi-chain account"
      />
      {step === "0" ? (
        <Option
          href="/setup/1"
          icon="log-in"
          title="I have an account"
          description="Import your existing account to Teko"
        />
      ) : (
        <Option
          href="/account/add/seed"
          icon="file-text"
          title="Import recovery phrase"
          description="Import your existing account using a recovery phrase"
        />
      )}
    </main>
  );
}

const Option = ({
  href,
  icon,
  title,
  description,
}: {
  href: Url;
  icon: IconName;
  title: string;
  description: string;
}) => (
  <Link
    href={href}
    className="grid grid-cols-[min-content_auto_min-content] grid-rows-2 width-full text-left gap-x-1 gap-y-2"
  >
    <DynamicIcon name={icon} size={30} className="row-span-2" />
    <h4>{title}</h4>
    <ChevronRight size={18} className="row-span-2 h-full" />
    <h5 className="text-teko-500">{description}</h5>
  </Link>
);
