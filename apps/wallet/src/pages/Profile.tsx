import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  DollarSign,
  Eye,
  KeyRound,
  LogOut,
  Wallet,
  X,
} from "lucide-preact";
import { useState } from "preact/hooks";
import { Link, useLocation } from "wouter-preact";
import { PinDots } from "../components/molecules/PinDots";
import { PinPadBoard } from "../components/molecules/PinPadBoard";
import { IconSize } from "../constants/IconSize";
import { getT } from "../lib/i18n";
import {
  decryptMnemonicWithPIN,
  useAccountStore,
} from "../stores/useAccountStore";
import {
  CURRENCIES,
  getCurrencyConfig,
  useSettingsStore,
  type Currency,
} from "../stores/useSettingsStore";

const PIN_SIZE = 4;

export const Profile = () => {
  const account = useAccountStore((state) => state.accounts[0]);
  const signOut = useAccountStore((state) => state.signOut);
  const [, navigate] = useLocation();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Recovery phrase modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [pin, setPin] = useState("");
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [pinError, setPinError] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinStep, setChangePinStep] = useState<
    "current" | "new" | "confirm" | "success"
  >("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(
    null
  );
  const changePin = useAccountStore((state) => state.changePin);

  // Currency selector state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const currency = useSettingsStore((state) => state.currency);
  const setCurrency = useSettingsStore((state) => state.setCurrency);
  const currencyConfig = getCurrencyConfig(currency);

  const handleSelectCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setShowCurrencyModal(false);
  };

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

  const openRecoveryModal = () => {
    setShowRecoveryModal(true);
    setPin("");
    setMnemonic(null);
    setPinError(false);
    setCopiedMnemonic(false);
  };

  const closeRecoveryModal = () => {
    setShowRecoveryModal(false);
    setPin("");
    setMnemonic(null);
    setPinError(false);
    setCopiedMnemonic(false);
  };

  const handlePinSubmit = async () => {
    if (pin.length !== PIN_SIZE || !account) return;

    try {
      const decrypted = await decryptMnemonicWithPIN(
        account.encryptedMnemonic,
        account.argonSalt,
        account.aesGcmIV,
        pin
      );
      setMnemonic(decrypted);
      setPinError(false);
    } catch {
      setPinError(true);
      setPin("");
    }
  };

  const copyMnemonic = async () => {
    if (!mnemonic) return;
    await navigator.clipboard.writeText(mnemonic);
    setCopiedMnemonic(true);
    setTimeout(() => setCopiedMnemonic(false), 2000);
  };

  // Change PIN handlers
  const openChangePinModal = () => {
    setShowChangePinModal(true);
    setChangePinStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmNewPin("");
    setChangePinError(null);
    setDecryptedMnemonic(null);
  };

  const closeChangePinModal = () => {
    setShowChangePinModal(false);
    setChangePinStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmNewPin("");
    setChangePinError(null);
    setDecryptedMnemonic(null);
  };

  const handleVerifyCurrentPin = async () => {
    if (currentPin.length !== PIN_SIZE || !account) return;

    try {
      const decrypted = await decryptMnemonicWithPIN(
        account.encryptedMnemonic,
        account.argonSalt,
        account.aesGcmIV,
        currentPin
      );
      setDecryptedMnemonic(decrypted);
      setChangePinError(null);
      setChangePinStep("new");
    } catch {
      setChangePinError(t("Incorrect PIN. Please try again."));
      setCurrentPin("");
    }
  };

  const handleNewPinSubmit = () => {
    if (newPin.length !== PIN_SIZE) return;
    setChangePinStep("confirm");
  };

  const handleConfirmNewPin = async () => {
    if (confirmNewPin.length !== PIN_SIZE) return;

    if (confirmNewPin !== newPin) {
      setChangePinError(t("PINs don't match. Please try again."));
      setConfirmNewPin("");
      return;
    }

    if (!decryptedMnemonic) return;

    try {
      await changePin(decryptedMnemonic, newPin);
      setChangePinStep("success");
    } catch {
      setChangePinError(t("Failed to change PIN. Please try again."));
    }
  };

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
          <div className="rounded-full p-4 w-20 h-20 bg-teqo-100 flex-center">
            <Wallet size={32} className="text-teqo-600" />
          </div>
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
            <SettingsButton
              icon={<DollarSign size={IconSize.md} />}
              label={t("Currency")}
              value={`${currencyConfig.symbol} ${currencyConfig.code}`}
              onClick={() => setShowCurrencyModal(true)}
            />
            <SettingsButton
              icon={<Eye size={IconSize.md} />}
              label={t("Recovery phrase")}
              onClick={openRecoveryModal}
            />
            <SettingsButton
              icon={<KeyRound size={IconSize.md} />}
              label={t("Change PIN")}
              onClick={openChangePinModal}
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

      {/* Recovery Phrase Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 pb-10 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">{t("Recovery phrase")}</h3>
              <button
                type="button"
                onClick={closeRecoveryModal}
                className="p-2 -mr-2 text-teqo-400"
              >
                <X size={24} />
              </button>
            </div>

            {!mnemonic ? (
              // PIN Entry View
              <div className="flex flex-col">
                <p className="text-teqo-400 text-center mb-2">
                  {t("Enter your PIN to reveal your recovery phrase")}
                </p>
                {pinError && (
                  <p className="text-red-500 text-center text-sm">
                    {t("Incorrect PIN. Please try again.")}
                  </p>
                )}
                <PinDots
                  size={PIN_SIZE}
                  isFilled={(index) => pin.length > index}
                />
                <PinPadBoard setValue={setPin} />
                <button
                  type="button"
                  onClick={handlePinSubmit}
                  disabled={pin.length !== PIN_SIZE}
                  className="mt-6 bg-tint text-white py-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("Confirm")}
                </button>
              </div>
            ) : (
              // Mnemonic View
              <div className="flex flex-col">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-amber-800 text-sm">
                    {t(
                      "Never share your recovery phrase. Anyone with these words can access your wallet."
                    )}
                  </p>
                </div>
                <div className="bg-teqo-100/50 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {mnemonic.split(" ").map((word, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5"
                      >
                        <span className="text-teqo-300 text-xs w-4">
                          {index + 1}
                        </span>
                        <span className="font-mono text-sm">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyMnemonic}
                  className="flex items-center justify-center gap-2 bg-teqo-100 py-4 rounded-xl font-medium"
                >
                  <Copy size={IconSize.sm} />
                  {copiedMnemonic ? t("Copied!") : t("Copy to clipboard")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 pb-10 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">{t("Change PIN")}</h3>
              <button
                type="button"
                onClick={closeChangePinModal}
                className="p-2 -mr-2 text-teqo-400"
              >
                <X size={24} />
              </button>
            </div>

            {changePinStep === "current" && (
              <div className="flex flex-col">
                <p className="text-teqo-400 text-center mb-2">
                  {t("Enter your current PIN")}
                </p>
                {changePinError && (
                  <p className="text-red-500 text-center text-sm">
                    {changePinError}
                  </p>
                )}
                <PinDots
                  size={PIN_SIZE}
                  isFilled={(index) => currentPin.length > index}
                />
                <PinPadBoard setValue={setCurrentPin} />
                <button
                  type="button"
                  onClick={handleVerifyCurrentPin}
                  disabled={currentPin.length !== PIN_SIZE}
                  className="mt-6 bg-tint text-white py-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("Confirm")}
                </button>
              </div>
            )}

            {changePinStep === "new" && (
              <div className="flex flex-col">
                <p className="text-teqo-400 text-center mb-2">
                  {t("Enter your new PIN")}
                </p>
                <PinDots
                  size={PIN_SIZE}
                  isFilled={(index) => newPin.length > index}
                />
                <PinPadBoard setValue={setNewPin} />
                <button
                  type="button"
                  onClick={handleNewPinSubmit}
                  disabled={newPin.length !== PIN_SIZE}
                  className="mt-6 bg-tint text-white py-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("Continue")}
                </button>
              </div>
            )}

            {changePinStep === "confirm" && (
              <div className="flex flex-col">
                <p className="text-teqo-400 text-center mb-2">
                  {t("Confirm your new PIN")}
                </p>
                {changePinError && (
                  <p className="text-red-500 text-center text-sm">
                    {changePinError}
                  </p>
                )}
                <PinDots
                  size={PIN_SIZE}
                  isFilled={(index) => confirmNewPin.length > index}
                />
                <PinPadBoard setValue={setConfirmNewPin} />
                <button
                  type="button"
                  onClick={handleConfirmNewPin}
                  disabled={confirmNewPin.length !== PIN_SIZE}
                  className="mt-6 bg-tint text-white py-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("Change PIN")}
                </button>
              </div>
            )}

            {changePinStep === "success" && (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex-center mb-4">
                  <KeyRound size={32} className="text-green-600" />
                </div>
                <h4 className="font-semibold text-lg mb-2">
                  {t("PIN changed successfully")}
                </h4>
                <p className="text-teqo-400 text-center text-sm mb-6">
                  {t("Your wallet is now secured with your new PIN.")}
                </p>
                <button
                  type="button"
                  onClick={closeChangePinModal}
                  className="w-full bg-tint text-white py-4 rounded-xl font-medium"
                >
                  {t("Done")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Currency Selector Modal */}
      {showCurrencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 pb-10 animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">{t("Select currency")}</h3>
              <button
                type="button"
                onClick={() => setShowCurrencyModal(false)}
                className="p-2 -mr-2 text-teqo-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-1 overflow-y-auto">
              {CURRENCIES.map((curr) => (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleSelectCurrency(curr.code)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${
                    currency === curr.code
                      ? "bg-tint/10 text-tint"
                      : "hover:bg-teqo-100/50"
                  }`}
                >
                  <span className="w-8 text-lg font-medium">{curr.symbol}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{curr.code}</p>
                    <p className="text-sm text-teqo-400">{curr.name}</p>
                  </div>
                  {currency === curr.code && (
                    <Check size={IconSize.md} className="text-tint" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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

const SettingsButton = ({
  icon,
  label,
  value,
  onClick,
}: {
  icon: preact.JSX.Element;
  label: string;
  value?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-3 p-4 rounded-xl hover:bg-teqo-100/50 transition-colors text-left"
  >
    <span className="text-teqo-600">{icon}</span>
    <span className="flex-1 font-medium">{label}</span>
    {value && <span className="text-teqo-400 text-sm">{value}</span>}
    <ChevronRight size={IconSize.md} className="text-teqo-300" />
  </button>
);

const t = getT({
  "Wallet addresses": "Endereços da carteira",
  Settings: "Configurações",
  Currency: "Moeda",
  "Select currency": "Selecionar moeda",
  "Recovery phrase": "Frase de recuperação",
  "Change PIN": "Alterar PIN",
  "Sign out": "Sair",
  "Copied!": "Copiado!",
  "Enter your PIN to reveal your recovery phrase":
    "Digite seu PIN para revelar sua frase de recuperação",
  "Incorrect PIN. Please try again.": "PIN incorreto. Tente novamente.",
  Confirm: "Confirmar",
  "Never share your recovery phrase. Anyone with these words can access your wallet.":
    "Nunca compartilhe sua frase de recuperação. Qualquer pessoa com essas palavras pode acessar sua carteira.",
  "Copy to clipboard": "Copiar",
  "Enter your current PIN": "Digite seu PIN atual",
  "Enter your new PIN": "Digite seu novo PIN",
  "Confirm your new PIN": "Confirme seu novo PIN",
  Continue: "Continuar",
  "PINs don't match. Please try again.":
    "Os PINs não coincidem. Tente novamente.",
  "Failed to change PIN. Please try again.":
    "Falha ao alterar PIN. Tente novamente.",
  "PIN changed successfully": "PIN alterado com sucesso",
  "Your wallet is now secured with your new PIN.":
    "Sua carteira agora está protegida com seu novo PIN.",
  Done: "Concluído",
});
