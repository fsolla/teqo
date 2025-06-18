import { NoWrap } from "@/components/atoms/NoWrap";
import Image from "next/image";

export const TekoMeaning = () => (
  <section className="text-center px-4 py-6 md:py-13 lg:py-22 flex justify-center">
    <h3 className="relative w-fit">
      <Image
        src="/left-quote.svg"
        width={70.46}
        height={58.3}
        alt="decoration left quote"
        className="max-lg:w-10.5 absolute -top-6 -left-7 md:-top-13 md:-left-13.5 lg:-top-22 lg:-left-30.25"
      />
      <Image
        src="/right-quote.svg"
        width={70.46}
        height={58.43}
        alt="decoration right quote"
        className="max-lg:w-10.5 absolute -bottom-6 -right-7 md:-bottom-13 md:-right-13.5 lg:-bottom-22 lg:-right-30.25"
      />
      <NoWrap>Teko é uma palavra Guarani que</NoWrap>{" "}
      <NoWrap>significa {'"modo de ser"'}</NoWrap>.<br />
      <NoWrap>A forma como vivemos</NoWrap> e nos{" "}
      <NoWrap>relacionamos com o mundo</NoWrap>.
    </h3>
  </section>
);
