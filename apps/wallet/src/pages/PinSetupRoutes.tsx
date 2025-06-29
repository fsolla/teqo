import { useState } from "preact/hooks";
import { Route } from "wouter-preact";
import { PinConfirmation } from "./PinConfirmation";
import { PinInput } from "./PinInput";

const PIN_SIZE = 4;

export const PinSetupRoutes = () => {
  const [pin, setPin] = useState<string>("");
  const [confirmationPin, setConfirmationPin] = useState<string>("");

  return (
    <>
      <Route path="/input/pin">
        <PinInput value={pin} setValue={setPin} size={PIN_SIZE} />
      </Route>
      <Route path="/confirm/pin">
        <PinConfirmation
          pin={pin}
          value={confirmationPin}
          setValue={setConfirmationPin}
          size={PIN_SIZE}
        />
      </Route>
    </>
  );
};
