import Image from "next/image";
import { EmailInput } from "../molecules/EmailInput";

export const Invite = () => (
  <section
    id="invite"
    className="snap-start h-dvh w-dvw relative flex bg-cyan-200 text-white overflow-hidden"
  >
    <div className="z-10 flex flex-col layout-max-width w-full h-full flex-1 p-5 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5">
      <div className="flex-15" />
      <h3>
        Step in
        <br />
        We&apos;ll do the rest
      </h3>
      <div className="flex-1" />
      <EmailInput />
      <div className="flex-15" />
      <p>
        Be among the first to try Teqo.
        <br />A calmer<span className="max-md:hidden">, clearer</span> way to
        step into Web3. <br className="md:hidden" /> Without the chaos.
      </p>
    </div>
    <Image
      src="/invite.png"
      width={1080}
      height={2819}
      alt="Minimalist 3D illustration of a series of light blue arched doorways receding into the distance, creating a tunnel-like effect with a sense of calm, depth, and invitation."
      className="absolute h-[80%] w-auto bottom-0 right-0 translate-x-[38%] landscape:-translate-x-[60%]"
    />
  </section>
);
