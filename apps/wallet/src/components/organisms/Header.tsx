import type { IconName } from "lucide-react/dynamic";
import { Link } from "wouter-preact";
import { Icon } from "../atoms/Icon";

export const Header = () => (
  <header className="bg-teqo-50 rounded-t-2xl px-5 pb-10.75 pt-4 flex flex-col items-end relative">
    <Link href="/notifications" className="absolute top-4 left-5">
      <Icon name="bell" size="sm" />
    </Link>
    <Link href="/settings" className="flex items-center">
      Portfolio
      <Icon name="chevron-down" size="sm" />
    </Link>
    <h1>$5,271.39</h1>
    <nav className="flex justify-between w-full mt-3">
      <ActionLink href="/connect" icon="scan-qr-code" label="Connect" />
      <ActionLink href="/buy-sell" icon="banknote" label="Buy/Sell" />
      <ActionLink href="/swap" icon="send-to-back" label="Swap" />
      <ActionLink href="/send" icon="send-horizontal" label="Send" />
      <ActionLink href="/receive" icon="qr-code" label="Receive" />
    </nav>
  </header>
);

const ActionLink = ({
  href,
  icon,
  label,
}: {
  href: string;
  icon: IconName;
  label: string;
}) => (
  <Link href={href} className="flex flex-col items-center">
    <Icon name={icon} size="lg" />
    {label}
  </Link>
);
