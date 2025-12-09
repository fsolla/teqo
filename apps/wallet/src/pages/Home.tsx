import { Wallet } from "lucide-preact";
import { Link } from "wouter-preact";
import { Image } from "../components/atoms/Image";
import { CoinsSection } from "../components/organisms/CoinsSection";
import { NavBar } from "../components/organisms/NavBar";
import { useCoins } from "../hooks/useCoins";
import { getT } from "../lib/i18n";

export const Home = () => {
  const { hasCoins } = useCoins();

  return (
    <div className="h-dvh w-dvw flex flex-col overflow-hidden">
      <header className="flex p-5">
        <Link
          href="/profile"
          className="rounded-full p-2.5 w-10 h-10 bg-gray-100 aspect-square flex-center"
        >
          <Wallet size={18} className="text-teqo-600" />
        </Link>
      </header>
      <main className="flex-1 p-5 flex flex-col overflow-y-auto">
        {hasCoins ? <CoinsSection /> : <WelcomeSection />}
      </main>
      <NavBar />
    </div>
  );
};

const WelcomeSection = () => (
  <>
    <div className="flex-1" />
    <section>
      <h1>{t("Welcome")}</h1>
      <p className="text-gray-400">
        {t("Buy crypto and start your Web3 journey.")}
      </p>
      <ul className="flex gap-2 mt-5">
        <Link
          href="/buy/btc"
          className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
          state={{ back: "/" }}
        >
          <Image src="/coins/bitcoin.svg" alt="Bitcoin" size="md" />
          <h4 className="mx-1">Bitcoin</h4>
        </Link>
        <Link
          href="/buy/eth"
          className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
          state={{ back: "/" }}
        >
          <Image src="/coins/ethereum.svg" alt="Ethereum" size="md" />
          <h4 className="mx-1">Ethereum</h4>
        </Link>
        <Link
          href="/buy/sol"
          className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
          state={{ back: "/" }}
        >
          <Image src="/coins/solana.svg" alt="Solana" size="md" />
          <h4 className="mx-1">Solana</h4>
        </Link>
      </ul>
    </section>
  </>
);

const t = getT({
  Welcome: "Bem-vindo",
  "Buy crypto and start your Web3 journey.":
    "Compre criptomoedas e comece sua jornada Web3.",
});
