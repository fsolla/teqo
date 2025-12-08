import type { Dispatch, StateUpdater } from "preact/hooks";
import { Forward } from "../components/atoms/Forward";
import { PinDots } from "../components/molecules/PinDots";
import { PinPadBoard } from "../components/molecules/PinPadBoard";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";
import { useAccountStore } from "../stores/useAccountStore";

export const PinConfirmation = ({
  value,
  setValue,
  size,
  pin,
}: {
  value: string;
  setValue: Dispatch<StateUpdater<string>>;
  size: number;
  pin: string;
}) => {
  const createAccount = useAccountStore.use.createAccount();
  const isFilled = (index: number) => value.length > index;
  const isValid = value.length === size && value === pin;

  const handleSubmit = () => {
    if (!isValid) {
      return;
    }

    return createAccount(pin);
  };

  return (
    <Page
      title={t("Confirm your PIN")}
      description={t("Re-enter your 4-digit PIN to confirm")}
    >
      <PinDots size={size} isFilled={isFilled} />
      <PinPadBoard setValue={setValue} />
      <div className="flex-1" />
      <Forward
        onClick={handleSubmit}
        disabled={!isValid}
        className="self-end"
      />
    </Page>
  );
};

const t = getT({
  "Confirm your PIN": "Confirme seu PIN",
  "Re-enter your 4-digit PIN to confirm":
    "Digite novamente seu PIN de 4 dígitos para confirmar",
});
