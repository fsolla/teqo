import Image from "next/image";

export const Future = () => (
  <section className="snap-start h-dvh w-dvw relative flex bg-black text-white overflow-hidden p-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5">
    <div className="z-10 flex flex-col layout-max-width w-full h-full flex-1">
      <h2>
        JOIN
        <br />
        THE FUTURE
        <br />
        OF FINANCE
      </h2>
      <p className="mt-3">
        It&apos;s not just about crypto.
        <br />
        It&apos;s about changing how we own.
      </p>
      <div className="flex-1 landscape:flex-6" />
      <p className="portrait:text-right">
        No more banks owning your money.
        <br />
        No more middlemen holding your value.
        <br />
        No more losing control of what you create.
      </p>
      <div className="flex-3" />
      <p className="portrait:self-center landscape:pb-8">A quiet revolution.</p>
    </div>
    <div className="absolute flex bottom-0 h-2/5 left-1/2 -translate-x-[37%] landscape:translate-x-[50%] text-white text-[14dvh]/[14dvh] landscape:h-10/12 landscape:text-[30dvh]/[30dvh] font-black">
      <Image
        src="/future.png"
        width={1644}
        height={3445}
        alt="Close-up of a raised clenched fist in dramatic lighting, symbolizing strength, resistance, and empowerment against a black background."
        className="h-full w-auto z-10"
      />
      <span className="absolute top-0 left-0 -translate-x-[70%]">t</span>
      <span className="absolute right-0 top-[25%] -translate-x-[10%]">e</span>
      <span className="absolute left-0 top-[30%] landscape:top-[35%] -translate-x-[70%]">
        q
      </span>
      <span className="absolute right-0 top-[50%] landscape:top-[60%] z-20 -translate-x-[40%]">
        o
      </span>
    </div>
  </section>
);
