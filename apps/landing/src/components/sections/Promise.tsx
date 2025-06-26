import Image from "next/image";
import Link from "next/link";

export const Promise = () => (
  <section className="snap-start h-dvh w-dvw  relative flex flex-col text-white p-5 gap-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5 md:pb-8 md:portrait:pb-12 overflow-hidden bg-linear-150 from-blue-300 to-blue-700">
    <div className="flex flex-col w-full flex-1 gap-5 z-20 layout-max-width">
      <h1>
        OWN
        <br />
        YOUR
        <br />
        MONEY
      </h1>
      <div className="flex flex-col gap-5 flex-1">
        <p>Teqo gives you an account you truly own</p>
        <div className="flex-1" />
        <Link
          href="#invite"
          className="px-6 py-3 4xl:py-7 4xl:px-10 rounded-2xl bg-linear-150 from-blue-800 from-20% to-blue-900 to-95% w-fit active:opacity-80 active:scale-95"
        >
          <h5>JOIN WAITLIST</h5>
        </Link>
        <p>
          You don&apos;t have to learn crypto
          <br />
          Just step in.
        </p>
        <div className="flex-2 max-md:hidden" />
      </div>
    </div>
    <Image
      src="/promise.png"
      width={1727}
      height={1384}
      alt="A man in blue clothing and a white bucket hat stands thoughtfully in a minimalist blue studio, casting a long shadow onto a curved backdrop lit by a spotlight"
      className="absolute w-[80%] bottom-1/2 translate-y-[70%] right-1/2 max-md:translate-x-1/2 md:w-[65%] md:right-[5dvw] lg:w-1/2 lg:translate-y-[65%] 3xl:translate-y-[60%]"
    />
  </section>
);
