import {
  Banknote,
  Bell,
  ChevronDown,
  QrCode,
  ScanQrCode,
  SendHorizontal,
  SendToBack,
  type LucideIcon,
} from "lucide-preact";
import { Link } from "wouter-preact";
import { IconSize } from "../../constants/IconSize";

export const Header = () => (
  <header className="bg-teqo-50 rounded-t-2xl px-5 pb-10.75 pt-4 flex flex-col items-end relative">
    <Link href="/notifications" className="absolute top-4 left-5">
      <Bell size={IconSize.sm} />
    </Link>
    <Link href="/settings" className="flex items-center">
      Portfolio
      <ChevronDown size={IconSize.sm} />
    </Link>
    <h1>$5,271.39</h1>
    <nav className="flex justify-between w-full mt-3">
      <ActionLink href="/connect" Icon={ScanQrCode} label="Connect" />
      <ActionLink href="/buy-sell" Icon={Banknote} label="Buy/Sell" />
      <ActionLink href="/swap" Icon={SendToBack} label="Swap" />
      <ActionLink href="/send" Icon={SendHorizontal} label="Send" />
      <ActionLink href="/receive" Icon={QrCode} label="Receive" />
    </nav>
  </header>
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
  <Link href={href} className="flex flex-col items-center">
    <Icon size={IconSize.lg} />
    {label}
  </Link>
);
