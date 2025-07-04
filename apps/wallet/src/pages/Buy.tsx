import type { ChangeEventHandler } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useParams } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";

export const Buy = () => {
  const { coin } = useParams<{ coin: string }>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isValid, setIsValid] = useState(false);

  const handleInput: ChangeEventHandler<HTMLInputElement> = (e) => {
    const num = Number(e.currentTarget.value.replaceAll(/[^0-9]/g, "")) * 0.01;

    setIsValid(num >= 1);

    const value =
      num === 0
        ? t("$0.00")
        : num.toLocaleString(t("en-US"), {
            style: "currency",
            currency: t("USD"),
          });

    e.currentTarget.value = value;
  };

  const handleSubmit: ChangeEventHandler<HTMLButtonElement> = async () => {};

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = t("$0.00");
    }
  }, []);

  return (
    <Page
      title={t("Choose amount")}
      description={t("Insert amount in US dolars you'd like to buy")}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        name="amount"
        placeholder={t("$0.00")}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        required
        title={t("Please enter a valid dollar amount.")}
        onChange={handleInput}
        maxLength={50}
      />
      <h4>0 {coin.toUpperCase()}</h4>
      <div className="flex-1" />
      <div className="flex">
        <div className="flex-1">
          <h4>{t("Tax")}</h4>
          <h5>{t("Will be discounted from inserted value")}</h5>
        </div>
        <Forward onClick={handleSubmit} disabled={!isValid} />
      </div>
    </Page>
  );
};

const t = getT({
  "en-US": "pt-BR",
  USD: "BRL",
  "$0.00": "R$ 0,00",
  "Choose amount": "Quanto quer comprar?",
  "Insert amount in US dolars you'd like to buy":
    "Insira o valor em reais que você gostaria de comprar",
  "Please enter a valid dollar amount.":
    "Por favor, insira um valor válido em reais.",
  Tax: "Taxa",
  "Will be discounted from inserted value": "Será descontada do valor inserido",
});
