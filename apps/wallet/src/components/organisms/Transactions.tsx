import { Image } from "../atoms/Image";

export const Transactions = () => (
  <section className="bg-teqo-50 rounded-2xl px-5 pb-4 pt-2 gap-2 relative flex flex-col items-center">
    <div className="w-6.75 h-1 bg-teqo-200 rounded-full" />
    <article className="flex gap-2 w-full">
      <figure className="size-10 relative">
        <Image
          src="/coins/ethereum.svg"
          alt="Sent Ethereum"
          size="sm"
          className="absolute bottom-0 left-0"
        />
        <Image
          src="/coins/bitcoin.svg"
          alt="Received Bitcoin"
          size="md"
          className="absolute top-0 right-0"
        />
      </figure>
      <header>
        <h4>Swap</h4>
        <h5 className="text-teqo-500">
          <time dateTime="2025-06-14 12:34">Today 12:34</time>
        </h5>
      </header>
      <div className="text-right flex-1">
        <h4>+0.04143 BTC</h4>
        <h5 className="text-teqo-500">-5.39043 ETH</h5>
      </div>
    </article>
  </section>
);
