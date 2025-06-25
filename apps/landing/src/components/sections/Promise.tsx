import Image from "next/image";
import Link from "next/link";

export const Promise = () => (
  <section className="snap-start h-dvh w-dvw  relative flex flex-col text-white p-5 gap-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5 md:pb-8 md:portrait:pb-12 overflow-hidden bg-[#0168c7]">
    <div className="flex flex-col w-full flex-1 gap-5 z-20 layout-max-width">
      <h1>
        OWN
        <br />
        YOUR
        <br />
        MONEY
      </h1>
      <div className="flex flex-col gap-5 flex-1 2xl:ml-8 4xl:ml-10">
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
      src="/promise.jpg"
      width={6699}
      height={4466}
      alt="A man in blue clothing and a white bucket hat stands thoughtfully in a minimalist blue studio, casting a long shadow onto a curved backdrop lit by a spotlight"
      className="max-md:w-[747px] md:w-dvw md:portrait:w-[150%] lg:landscape:h-[150%] lg:w-auto self-center z-10 absolute top-1/2 -translate-y-[45%] lg:-translate-y-[35%] lg:landscape:-translate-y-[52%] max-md:translate-x-[2%] md:portrait:-translate-x-[8%] md:left-0 md:translate-x-[8%]"
    />
    <div className="h-1/2 w-dvw  absolute bottom-0 left-0 bg-[#0168c7]" />
  </section>
);
