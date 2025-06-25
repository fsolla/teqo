import Image from "next/image";

export const Trust = () => (
  <section className="snap-start h-dvh w-dvw relative text-black bg-white px-5 py-10 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5 md:pb-8 md:portrait:pb-12">
    <div className="layout-max-width flex flex-col gap-5">
      <h2>
        SAFE
        <br />
        LIKE A BANK
        <br />
        NOT A BANK
      </h2>
      <p>
        Your Teqo account is personal.
        <br />
        It holds your assets, but we never touch them.
        <br />
        Not for lending. Not for profit.
        <br />
        Not even for a second.
      </p>
      <p>You’re the only one in control. Always.</p>
      <div className="flex-1 landscape:hidden" />
    </div>
    <Image
      src="/trust.png"
      width={1244}
      height={1838}
      alt="A smartphone mockup displaying a digital wallet interface, with a portfolio overview and balances for Ethereum, Bitcoin, and Arbitrum. Icons for connect, swap, and send are visible on the bottom navigation."
      className="w-[285px] md:portrait:w-[60%] landscape:h-[100%] landscape:w-auto absolute top-1/2 -translate-y-1/5 landscape:-translate-y-[48%] md:portrait:-translate-y-[30%] left-1/2 portrait:-translate-x-1/2"
    />
  </section>
);
