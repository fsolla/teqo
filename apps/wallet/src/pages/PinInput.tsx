import type { Dispatch, StateUpdater } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { PinDots } from "../components/molecules/PinDots";
import { PinPadBoard } from "../components/molecules/PinPadBoard";
import { Page } from "../components/templates/Page";

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
      title="Choose your PIN"
      description="Enter a 4-digit PIN to secure your account"
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
