import type { Dispatch, StateUpdater } from "preact/hooks";
import { PinPad } from "../atoms/PinPad";

export const PinPadBoard = ({
  setValue,
}: {
  setValue: Dispatch<StateUpdater<string>>;
}) => (
  <div className="grid grid-cols-3 w-fit gap-x-9 gap-y-7 self-center">
    <PinPad value="1" set={setValue} />
    <PinPad value="2" set={setValue} />
    <PinPad value="3" set={setValue} />
    <PinPad value="4" set={setValue} />
    <PinPad value="5" set={setValue} />
    <PinPad value="6" set={setValue} />
    <PinPad value="7" set={setValue} />
    <PinPad value="8" set={setValue} />
    <PinPad value="9" set={setValue} />
    <div />
    <PinPad value="0" set={setValue} />
    <PinPad value="Backspace" set={setValue} />
  </div>
);
