import { Link } from "wouter-preact";
import { Image } from "../components/atoms/Image";
import { NavBar } from "../components/organisms/NavBar";
import { useAccountStore } from "../stores/useAccountStore";

export const Home = () => {
  const symbol = useAccountSymbol();

  return (
    <div className="h-dvh w-dvw flex flex-col overflow-hidden">
      <header className="flex p-5">
        <Link
          href="/profile"
          className="rounded-full p-2.5 w-10 h-10 bg-gray-100 aspect-square flex-center text-h4"
        >
          {symbol}
        </Link>
      </header>
      <main className="flex-1 p-5 flex flex-col">
        <div className="flex-1" />
        <section>
          <h1>Welcome</h1>
          <p className="text-gray-400">
            Buy crypto and start your Web3 journey.
          </p>
          <ul className="flex gap-2 mt-5">
            <Link
              href="/buy/btc"
              className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
            >
              <Image src="/coins/bitcoin.svg" alt="Bitcoin" size="md" />
              <h4 className="mx-1">Bitcoin</h4>
            </Link>
            <Link
              href="/buy/eth"
              className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
            >
              <Image src="/coins/ethereum.svg" alt="Ethereum" size="md" />
              <h4 className="mx-1">Ethereum</h4>
            </Link>
            <Link
              href="/buy/sol"
              className="bg-gray-100 rounded-2xl p-2 w-25 h-25 flex flex-col justify-between"
            >
              <Image src="/coins/solana.svg" alt="Solana" size="md" />
              <h4 className="mx-1">Solana</h4>
            </Link>
          </ul>
        </section>
      </main>
      <NavBar />
    </div>
  );
};

const useAccountSymbol = () =>
  useAccountStore((state) => {
    const name = state.accounts[0]?.name;
    if (!name) return undefined;
    return (
      name
        .split(" ")
        .map((word) => word[0].toUpperCase())
        .join("") + name[1].toUpperCase()
    ).slice(0, 2);
  });
