import type { PinPadValue } from "@/components/atoms/PinPad";
import type { ComponentType } from "react";

export const PinPadBoard = ({
  pad: Pad,
}: {
  pad: ComponentType<{ value: PinPadValue }>;
}) => (
  <div className="grid grid-cols-3 w-fit gap-x-9 gap-y-7 self-center">
    <Pad value="1" />
    <Pad value="2" />
    <Pad value="3" />
    <Pad value="4" />
    <Pad value="5" />
    <Pad value="6" />
    <Pad value="7" />
    <Pad value="8" />
    <Pad value="9" />
    <div />
    <Pad value="0" />
    <Pad value="Backspace" />
  </div>
);
