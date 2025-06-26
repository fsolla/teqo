import Image from "next/image";
import { NoWrap } from "../atoms/NoWrap";

export const Freedom = () => (
  <section className="snap-start h-dvh w-dvw relative flex overflow-hidden p-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5 bg-linear-0 to-[#DCDCDC] from-[#C1C1C1]">
    <div className="z-10 flex flex-col layout-max-width w-full h-full flex-1 text-black">
      <div className="flex flex-col gap-3">
        <h2>MOVE</h2>
        <h3 className="opacity-35">WITHOUT PERMISSION</h3>
        <h3 className="opacity-25">WITH CONFIDENCE</h3>
        <h3 className="opacity-15">WITH INTENTION</h3>
      </div>
      <div className="flex-1" />
      <p className="text-right">
        Your assets are always yours.
        <br />
        <NoWrap>Teqo gives you freedom.</NoWrap>{" "}
        <NoWrap>And support when you need it.</NoWrap>
        <br />
        <NoWrap>We don’t lock you in.</NoWrap>{" "}
        <NoWrap>We help you move forward.</NoWrap>
      </p>
      <div className="flex-3 landscape:flex-6" />
    </div>
    <Image
      src="/freedom.png"
      width={3840}
      height={6922}
      alt="Silhouette of two people joyfully leaning out of a car on an empty road at sunset, arms raised in celebration, capturing a feeling of freedom and adventure."
      className="absolute w-full left-0 bottom-0 landscape:translate-y-[65%]"
    />
  </section>
);
