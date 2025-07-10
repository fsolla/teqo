import { getT } from "@/lib/i18n";
import Image from "next/image";
import { use } from "react";

export const Trust = () => {
  const t = use(getT(dict));

  return (
    <section className="snap-start h-dvh w-dvw relative text-black bg-white px-5 py-10 md:pt-[6dvh] lg:pt-[9dvh] md:px-17.5 md:pb-8 md:portrait:pb-12">
      <div className="layout-max-width flex flex-col gap-5">
        <h2>
          {t("SAFE")}
          <br />
          {t("LIKE A BANK")}
          <br />
          {t("BUT BETTER")}
        </h2>
        <p>
          {t("Your Teqo account is personal.")}
          <br />
          {t("It holds your assets, but we never touch them.")}
          <br />
          {t("Not for lending. Not for profit.")}
          <br />
          {t("Not even for a second.")}
        </p>
        <p>{t("You’re the only one in control. Always.")}</p>
        <div className="flex-1 landscape:hidden" />
      </div>
      <Image
        src="/trust.png"
        width={1244}
        height={1838}
        alt={t(
          "A smartphone mockup displaying a digital wallet interface, with a portfolio overview and balances for Ethereum, Bitcoin, and Arbitrum. Icons for connect, swap, and send are visible on the bottom navigation."
        )}
        className="w-[285px] md:portrait:w-[60%] landscape:h-[100%] landscape:w-auto absolute top-1/2 -translate-y-1/5 landscape:-translate-y-[48%] md:portrait:-translate-y-[30%] left-1/2 portrait:-translate-x-1/2"
      />
    </section>
  );
};

const dict = {
  SAFE: "SEGURO",
  "LIKE A BANK": "COMO UM BANCO",
  "BUT BETTER": "MAS MELHOR",
  "Your Teqo account is personal.": "Sua conta Teqo é pessoal.",
  "It holds your assets, but we never touch them.":
    "Ela guarda seus ativos, mas nunca tocamos neles.",
  "Not for lending. Not for profit.":
    "Não usamos para empréstimos. Não usamos para lucro.",
  "Not even for a second.": "Nem por um segundo.",
  "You’re the only one in control. Always.": "Só você tem o controle. Sempre.",
  "A smartphone mockup displaying a digital wallet interface, with a portfolio overview and balances for Ethereum, Bitcoin, and Arbitrum. Icons for connect, swap, and send are visible on the bottom navigation.":
    "Uma maquete de smartphone exibindo uma interface de carteira digital, com uma visão geral do portfólio e saldos para Ethereum, Bitcoin e Arbitrum. Ícones para conectar, trocar e enviar estão visíveis na navegação inferior.",
};
