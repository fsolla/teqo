import Image from "next/image";
import { EmailInput } from "../molecules/EmailInput";

export const Hero = () => (
  <header className="h-dvh bg-blue-950 flex-center flex-col w-full px-2">
    <div className="flex flex-col items-stretch justify-center max-lg:max-w-77.5 gap-4 lg:gap-7.5">
      <Image
        src="/logo.svg"
        width={133.64}
        height={90}
        alt="Teqo Logo"
        className="self-center max-lg:h-16"
      />
      <h1 className="text-white text-center">
        Seu mundo digital.
        <br />
        <span className="bg-gradient-cyan-to-purple bg-clip-text text-transparent">
          Suas regras.
        </span>
      </h1>
      <EmailInput />
      <p className="text-blue-100 text-center">
        Teqo é a carteira digital que torna Web3 <br className="lg:hidden" />
        simples, segura e acessível.
      </p>
    </div>
  </header>
);
