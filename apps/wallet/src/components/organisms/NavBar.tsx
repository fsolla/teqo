import {
  Banknote,
  QrCode,
  ScanQrCode,
  SendHorizontal,
  SendToBack,
  type LucideIcon,
} from "lucide-preact";
import { Link } from "wouter-preact";
import { IconSize } from "../../constants/IconSize";
import { getT } from "../../lib/i18n";

export const NavBar = () => (
  <nav className="flex justify-between w-full">
    <ActionLink href="/connect" Icon={ScanQrCode} label={t("Connect")} />
    <ActionLink href="/swap" Icon={SendToBack} label={t("Swap")} />
    <ActionLink href="/buy-sell" Icon={Banknote} label={t("Buy/Sell")} />
    <ActionLink href="/send" Icon={SendHorizontal} label={t("Send")} />
    <ActionLink href="/receive" Icon={QrCode} label={t("Receive")} />
  </nav>
);

const ActionLink = ({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
}) => (
  <Link href={href} className="flex flex-col items-center p-5 text-xs">
    <Icon size={IconSize.lg} stroke-width={1.5} />
    {label}
  </Link>
);

const t = getT({
  Connect: "Conectar",
  Swap: "Trocar",
  "Buy/Sell": "Comprar/Vender",
  Send: "Enviar",
  Receive: "Receber",
});
