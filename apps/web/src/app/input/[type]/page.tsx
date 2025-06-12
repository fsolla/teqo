import { Forward } from "lucide-react";
import { redirect } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ type: "recovery-phrase" | "name" }>;
}) {
  const { type } = use(params);

  if (!["recovery-phrase", "name"].includes(type)) {
    redirect("/");
  }

  const { title, description, placeholder, next } = Data[type];

  return (
    <main>
      <h2>{title}</h2>
      <p className="text-teko-400">{description}</p>
      <input type="text" placeholder={placeholder} autoFocus />
      <Forward href={next} className="self-end mr-4" />
    </main>
  );
}

const Data = {
  "recovery-phrase": {
    title: "Recovery phrase",
    description:
      "Import an existing wallet with 12 or 24-word recovery phrase.",
    placeholder: "Enter your recovery phrase",
    next: "/input/name",
  },
  "private-key": {
    title: "Private key",
    description: "Import an existing single-chain account using a private key.",
    placeholder: "Enter your private key",
    next: "/input/name",
  },
  name: {
    title: "Name your account",
    description: "Choose a name for your account.",
    placeholder: "Enter account name",
    next: "/account/add/seed",
  },
} as const;
