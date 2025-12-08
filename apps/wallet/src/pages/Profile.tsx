import {
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  LogOut,
  Shield,
  Wallet,
} from "lucide-preact";
import { useState } from "preact/hooks";
import { Link, useLocation } from "wouter-preact";
import { IconSize } from "../constants/IconSize";
import { getT } from "../lib/i18n";
import { useAccountStore } from "../stores/useAccountStore";

export const Profile = () => {
  const account = useAccountStore((state) => state.accounts[0]);
  const signOut = useAccountStore((state) => state.signOut);
  const [, navigate] = useLocation();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const copyToClipboard = async (address: string, type: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(type);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const truncateAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="h-dvh w-dvw flex flex-col overflow-hidden bg-white">
      <header className="flex items-center p-5">
        <Link href="/" className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hidden">
        {/* Profile Header */}
        <section className="flex flex-col items-center py-8 border-b border-teqo-100">
          <div className="rounded-full p-4 w-20 h-20 bg-teqo-100 flex-center mb-3">
            <Wallet size={32} className="text-teqo-600" />
          </div>
          <h3 className="font-semibold">{t("My wallet")}</h3>
        </section>

        {/* Wallet Addresses */}
        <section className="p-5 border-b border-teqo-100">
          <h4 className="text-teqo-400 mb-4 text-xs uppercase tracking-wider">
            {t("Wallet addresses")}
          </h4>
          <div className="flex flex-col gap-3">
            {account?.ethereum[0] && (
              <AddressRow
                label="Ethereum"
                address={account.ethereum[0]}
                truncated={truncateAddress(account.ethereum[0])}
                copied={copiedAddress === "ethereum"}
                onCopy={() => copyToClipboard(account.ethereum[0], "ethereum")}
              />
            )}
            {account?.solana[0] && (
              <AddressRow
                label="Solana"
                address={account.solana[0]}
                truncated={truncateAddress(account.solana[0])}
                copied={copiedAddress === "solana"}
                onCopy={() => copyToClipboard(account.solana[0], "solana")}
              />
            )}
            {account?.bitcoin[0] && (
              <AddressRow
                label="Bitcoin"
                address={account.bitcoin[0]}
                truncated={truncateAddress(account.bitcoin[0])}
                copied={copiedAddress === "bitcoin"}
                onCopy={() => copyToClipboard(account.bitcoin[0], "bitcoin")}
              />
            )}
          </div>
        </section>

        {/* Settings */}
        <section className="p-5">
          <h4 className="text-teqo-400 mb-4 text-xs uppercase tracking-wider">
            {t("Settings")}
          </h4>
          <div className="flex flex-col gap-1">
            <SettingsRow
              icon={<KeyRound size={IconSize.md} />}
              label={t("Change PIN")}
              href="/profile/pin"
            />
            <SettingsRow
              icon={<Shield size={IconSize.md} />}
              label={t("Security")}
              href="/profile/security"
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="p-5 mt-auto">
          <button
            type="button"
            className="flex items-center gap-3 w-full p-4 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
            onClick={handleSignOut}
          >
            <LogOut size={IconSize.md} />
            <span className="font-medium">{t("Sign out")}</span>
          </button>
        </section>
      </main>
    </div>
  );
};

const AddressRow = ({
  label,
  truncated,
  copied,
  onCopy,
}: {
  label: string;
  address: string;
  truncated: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <button
    type="button"
    onClick={onCopy}
    className="flex items-center justify-between p-3 rounded-xl bg-teqo-100/50 hover:bg-teqo-100 transition-colors"
  >
    <div className="flex flex-col items-start">
      <span className="text-xs text-teqo-400">{label}</span>
      <span className="font-mono text-sm">{truncated}</span>
    </div>
    <div className="flex items-center gap-2">
      {copied ? (
        <span className="text-xs text-tint">{t("Copied!")}</span>
      ) : (
        <Copy size={IconSize.sm} className="text-teqo-400" />
      )}
    </div>
  </button>
);

const SettingsRow = ({
  icon,
  label,
  href,
}: {
  icon: preact.JSX.Element;
  label: string;
  href: string;
}) => (
  <Link
    href={href}
    className="flex items-center gap-3 p-4 rounded-xl hover:bg-teqo-100/50 transition-colors"
  >
    <span className="text-teqo-600">{icon}</span>
    <span className="flex-1 font-medium">{label}</span>
    <ChevronRight size={IconSize.md} className="text-teqo-300" />
  </Link>
);

const t = getT({
  "My wallet": "Minha carteira",
  "Wallet addresses": "Endereços da carteira",
  Settings: "Configurações",
  "Change PIN": "Alterar PIN",
  Security: "Segurança",
  "Sign out": "Sair",
  "Copied!": "Copiado!",
});
