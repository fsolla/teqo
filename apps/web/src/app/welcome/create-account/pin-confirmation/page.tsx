import { InputView } from "../InputView";
import { PinDotRow } from "../PinDotRow";
import { PinPadBoard } from "../PinPadBoard";
import { Dot } from "./Dot";
import { Pad } from "./Pad";
import { Submit } from "./Submit";

export default function Page() {
  return (
    <InputView
      title="Confirm your PIN"
      description="This PIN protects your wallet on this device"
    >
      <PinDotRow dot={Dot} />
      <PinPadBoard pad={Pad} />
      <Submit />
    </InputView>
  );
}
