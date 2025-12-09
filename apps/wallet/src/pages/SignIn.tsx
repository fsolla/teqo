import { ChevronRight } from "lucide-preact";
import { Link } from "wouter-preact";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";

export const SignIn = () => {
  return (
    <Page>
      <div className="flex-1" />
      <h1 className="text-center">Teqo</h1>
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-5">
        <Link
          href="/input/pin"
          className="bg-tint px-8.5 py-6.5 text-white flex justify-between items-center rounded-2xl w-full"
        >
          <h4>{t("Create new wallet")}</h4>
          <ChevronRight size={30} />
        </Link>
        <Link href="/import" className="text-teqo-400 text-sm">
          {t("I have a wallet")}
        </Link>
      </div>
      <div className="flex-1" />
    </Page>
  );
};

const t = getT({
  "Create new wallet": "Criar nova carteira",
  "I have a wallet": "Já tenho uma carteira",
});
