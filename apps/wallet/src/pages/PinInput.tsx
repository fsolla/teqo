import type { Dispatch, StateUpdater } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { PinDots } from "../components/molecules/PinDots";
import { PinPadBoard } from "../components/molecules/PinPadBoard";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";

export const PinInput = ({
  value,
  size,
  setValue,
}: {
  value: string;
  size: number;
  setValue: Dispatch<StateUpdater<string>>;
}) => {
  const [, navigate] = useLocation();
  const isFilled = (index: number) => value.length > index;
  const isValid = value.length === size;

  const handlePinSubmit = () => {
    if (isValid) {
      navigate("/confirm/pin");
    }
  };

  return (
    <Page
      title={t("Choose your PIN")}
      description={t("Enter a 4-digit PIN to secure your account")}
    >
      <PinDots size={size} isFilled={isFilled} />
      <PinPadBoard setValue={setValue} />
      <div className="flex-1" />
      <Forward
        onClick={handlePinSubmit}
        disabled={!isValid}
        className="self-end"
      />
    </Page>
  );
};

const t = getT({
  "Choose your PIN": "Escolha seu PIN",
  "Enter a 4-digit PIN to secure your account":
    "Digite um PIN de 4 dígitos para proteger sua conta",
});
