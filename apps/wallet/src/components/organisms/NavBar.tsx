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

export const NavBar = () => (
  <nav className="flex justify-between w-full">
    <ActionLink href="/connect" Icon={ScanQrCode} label="Connect" />
    <ActionLink href="/swap" Icon={SendToBack} label="Swap" />
    <ActionLink href="/buy-sell" Icon={Banknote} label="Buy/Sell" />
    <ActionLink href="/send" Icon={SendHorizontal} label="Send" />
    <ActionLink href="/receive" Icon={QrCode} label="Receive" />
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
