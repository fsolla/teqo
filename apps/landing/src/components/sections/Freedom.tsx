import Image from "next/image";
import { NoWrap } from "../atoms/NoWrap";

export const Freedom = () => (
  <section className="snap-start h-dvh w-dvw relative flex overflow-hidden">
    <div className="z-10 flex flex-col layout-max-width w-full h-full flex-1 text-black p-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5">
      <div className="flex flex-col gap-3">
        <h2>MOVE</h2>
        <h3 className="opacity-30">WITHOUT PERMISSION</h3>
        <h3 className="opacity-20">WITH CONFIDENCE</h3>
        <h3 className="opacity-10">WITH INTENTION</h3>
      </div>
      <div className="flex-1" />
      <p className="text-right">
        Your assets are always yours.
        <br />
        <NoWrap>Teqo gives you freedom.</NoWrap>{" "}
        <NoWrap>And support when you need it.</NoWrap>
        <br />
        We don’t lock you in. We help you move forward.
      </p>
      <div className="flex-3 landscape:flex-6" />
    </div>
    <Image
      src="/freedom.png"
      width={3840}
      height={6922}
      alt="Silhouette of two people joyfully leaning out of a car on an empty road at sunset, arms raised in celebration, capturing a feeling of freedom and adventure."
      className="absolute h-full w-auto min-w-full md:h-auto md:w-full left-0 top-0 md:-translate-y-[10%] landscape:lg:-translate-y-[41%] landscape:xl:-translate-y-[44%] landscape:2xl:-translate-y-[46%]"
    />
  </section>
);
