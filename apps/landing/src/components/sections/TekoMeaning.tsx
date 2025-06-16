import { NoWrap } from "@/components/atoms/NoWrap";
import Image from "next/image";

export const TekoMeaning = () => (
  <section className="text-center px-4 py-6">
    <h3 className="relative">
      <Image
        src="/left-quote.svg"
        width={70.46}
        height={58.3}
        alt="decoration left quote"
        className="w-10.5 absolute -top-6 -left-7"
      />
      <NoWrap>Teko é uma palavra Guarani que</NoWrap>{" "}
      <NoWrap>significa {'"modo de ser"'}</NoWrap>.<br />
      <NoWrap>A forma como vivemos</NoWrap> e nos{" "}
      <NoWrap>relacionamos com o mundo</NoWrap>.
      <Image
        src="/right-quote.svg"
        width={70.46}
        height={58.43}
        alt="decoration right quote"
        className="w-10.5 absolute -bottom-6 -right-7"
      />
    </h3>
  </section>
);
