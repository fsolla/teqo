import { Forward } from "@/components/atoms/Forward";
import clsx from "clsx";
import Image from "next/image";
import { redirect } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ step: keyof typeof Steps }>;
}) {
  const { step } = use(params);

  if (!Steps[step]) {
    redirect(`/welcome/discover-ownership`);
  }

  return (
    <main className="flex flex-col items-center gap-2 h-full">
      <header className="flex-1 flex flex-col gap-4 pt-21 px-9 w-full">
        <h2>
          {Steps[step].title[0]}
          <br />
          {Steps[step].title[1]}
        </h2>
        <p className="text-teqo-400">
          {Steps[step].description[0]}
          <br className="mb-2" />
          {Steps[step].description[1]}
        </p>
      </header>
      <Forward href={Steps[step].next} className="self-end mr-4" />
      <div className="flex gap-2">
        {Object.keys(Steps).map((s) => (
          <div
            key={s}
            className={clsx(
              "rounded-full w-2 aspect-square",
              s === step ? "bg-teqo-900" : "bg-teqo-300"
            )}
          />
        ))}
      </div>
      <Image
        src={`/images/welcome/${step}.png`}
        alt={Steps[step].alt}
        width={500}
        height={500}
        className="rounded-t-2xl"
      />
    </main>
  );
}

const Steps = {
  "discover-ownership": {
    title: ["Step into a world", "you truly own"],
    description: [
      "You hold the keys to your assets, your identity, your future.",
      "No banks. No middlemen.",
    ],
    alt: "A person in a cloak stands at a crossroads of bridges, looking out at seven floating islands in the sky. Each island depicts a different theme, including art, knowledge, community, and wealth, all connected by glowing lines of light.",
    next: "/welcome/explore-community",
  },
  "explore-community": {
    title: ["You're not alone", "on this journey"],
    description: [
      "Teqo is your companion in a network of builders, artists, and everyday people.",
      "Reclaiming the digital world together.",
    ],
    alt: "A diverse community of people stands in a circle around a central glowing orb. Thin lines of light connect the orb to various icons floating above them, representing concepts like nature, technology, finance, and global connection.",
    next: "/welcome/define-your-legacy",
  },
  "define-your-legacy": {
    title: ["This is your treasury", "your legacy"],
    description: [
      "Your digital world becomes a living archive.",
      "Owned by you, shaped by your choices.",
    ],
    alt: "A person with light-colored hair holds a crystal pyramid, which refracts light into a burst of glowing digital icons, including 'NFT' and other tech symbols. In the background, other people walk through a futuristic city with organic architecture.",
    next: "/get-started",
  },
} as const;
