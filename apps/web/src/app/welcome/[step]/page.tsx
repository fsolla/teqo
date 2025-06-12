import { Forward } from "@/components/atoms/Forward";
import clsx from "clsx";
import Image from "next/image";
import { redirect } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ step: (typeof STEPS)[number] }>;
}) {
  const { step } = use(params);

  if (!STEPS.includes(step)) {
    redirect("/welcome/0");
  }

  const nextStep =
    step !== "2" ? `/welcome/${Number(step) + 1}` : "/welcome/menu";

  return (
    <main className="flex flex-col items-center gap-2 h-full">
      <header className="flex-1 flex flex-col gap-4 pt-21 px-9 w-full">
        <h2>
          {TITLES[step][0]}
          <br />
          {TITLES[step][1]}
        </h2>
        <p className="text-teko-400">
          {DESCRIPTIONS[step][0]}
          <br className="mb-2" />
          {DESCRIPTIONS[step][1]}
        </p>
      </header>
      <Forward href={nextStep} className="self-end mr-4" />
      <div className="flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s}
            className={clsx(
              "rounded-full w-2 aspect-square",
              s === step ? "bg-teko-900" : "bg-teko-300"
            )}
          />
        ))}
      </div>
      <Image
        src={`/images/welcome/${step}.png`}
        alt={ALTS[step]}
        width={500}
        height={500}
        className="rounded-t-2xl"
      />
    </main>
  );
}

const STEPS = ["0", "1", "2"] as const;

const TITLES = [
  ["Step into a world", "you truly own"],
  ["You're not alone", "on this journey"],
  ["This is your treasury", "your legacy"],
];

const DESCRIPTIONS = [
  [
    "You hold the keys to your assets, your identity, your future.",
    "No banks. No middlemen.",
  ],
  [
    "Teko is your companion in a network of builders, artists, and everyday people.",
    "Reclaiming the digital world together.",
  ],
  [
    "Your digital world becomes a living archive.",
    "Owned by you, shaped by your choices.",
  ],
];

const ALTS = [
  "A person in a cloak stands at a crossroads of bridges, looking out at seven floating islands in the sky. Each island depicts a different theme, including art, knowledge, community, and wealth, all connected by glowing lines of light.",
  "A diverse community of people stands in a circle around a central glowing orb. Thin lines of light connect the orb to various icons floating above them, representing concepts like nature, technology, finance, and global connection.",
  "A person with light-colored hair holds a crystal pyramid, which refracts light into a burst of glowing digital icons, including 'NFT' and other tech symbols. In the background, other people walk through a futuristic city with organic architecture.",
];
