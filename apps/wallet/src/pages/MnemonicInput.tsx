import { useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";
import { isValidMnemonic } from "../stores/useAccountStore";

export const MnemonicInput = () => {
  const [, navigate] = useLocation();
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  const wordCount = normalizedMnemonic ? normalizedMnemonic.split(" ").length : 0;
  const isValidLength = wordCount === 12 || wordCount === 24;
  const isValid = isValidLength && isValidMnemonic(normalizedMnemonic);

  const handleSubmit = () => {
    if (!isValidLength) {
      setError(t("Recovery phrase must be 12 or 24 words"));
      return;
    }

    if (!isValidMnemonic(normalizedMnemonic)) {
      setError(t("Invalid recovery phrase. Please check your words."));
      return;
    }

    navigate("/input/pin", { state: { mnemonic: normalizedMnemonic } });
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setMnemonic(target.value);
    setError(null);
  };

  return (
    <Page
      title={t("Import wallet")}
      description={t("Enter your 12 or 24-word recovery phrase")}
    >
      <div className="flex flex-col flex-1">
        <textarea
          value={mnemonic}
          onInput={handleInput}
          placeholder={t("Enter your recovery phrase...")}
          className="w-full h-40 p-4 bg-teqo-100/50 rounded-xl resize-none font-mono text-sm leading-relaxed focus:ring-2 focus:ring-tint focus:bg-white transition-colors"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellcheck={false}
        />
        <div className="flex justify-between mt-2 text-sm">
          <span className={error ? "text-red-500" : "text-teqo-400"}>
            {error || `${wordCount} ${t("words")}`}
          </span>
          {isValidLength && (
            <span className={isValid ? "text-green-500" : "text-teqo-400"}>
              {isValid ? t("Valid") : t("Checking...")}
            </span>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
          <p className="text-amber-800 text-sm">
            {t(
              "Make sure you're in a private place. Never enter your recovery phrase on a public or shared device."
            )}
          </p>
        </div>

        <div className="flex-1" />

        <Forward
          onClick={handleSubmit}
          disabled={!isValid}
          className="self-end"
        />
      </div>
    </Page>
  );
};

const t = getT({
  "Import wallet": "Importar carteira",
  "Enter your 12 or 24-word recovery phrase":
    "Digite sua frase de recuperação de 12 ou 24 palavras",
  "Enter your recovery phrase...": "Digite sua frase de recuperação...",
  words: "palavras",
  Valid: "Válido",
  "Checking...": "Verificando...",
  "Recovery phrase must be 12 or 24 words":
    "A frase de recuperação deve ter 12 ou 24 palavras",
  "Invalid recovery phrase. Please check your words.":
    "Frase de recuperação inválida. Verifique suas palavras.",
  "Make sure you're in a private place. Never enter your recovery phrase on a public or shared device.":
    "Certifique-se de estar em um local privado. Nunca digite sua frase de recuperação em um dispositivo público ou compartilhado.",
});

