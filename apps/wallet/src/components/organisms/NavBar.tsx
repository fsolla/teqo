import {
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
  <nav className="flex justify-between w-full p-5">
    <ActionLink href="/connect" Icon={ScanQrCode} label={t("Connect")} />
    <ActionLink href="/swap" Icon={SendToBack} label={t("Trade")} />
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
  <Link href={href} className="flex flex-col items-center text-xs">
    <Icon size={IconSize.lg} stroke-width={1.5} />
    {label}
  </Link>
);

const t = getT({
  Connect: "Conectar",
  Trade: "Negociar",
  Send: "Enviar",
  Receive: "Receber",
});
