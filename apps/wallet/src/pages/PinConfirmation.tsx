import type { Dispatch, StateUpdater } from "preact/hooks";
import { Forward } from "../components/atoms/Forward";
import { PinDots } from "../components/molecules/PinDots";
import { PinPadBoard } from "../components/molecules/PinPadBoard";
import { Page } from "../components/templates/Page";
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

    const name = history.state?.name;

    if (!name) {
      return;
    }

    return createAccount(name, pin);
  };

  return (
    <Page
      title="Confirm your PIN"
      description="Re-enter your 4-digit PIN to confirm"
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
