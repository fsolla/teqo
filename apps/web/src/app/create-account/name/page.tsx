import { InputView } from "../InputView";
import { NameInput } from "./NameInput";
import { NameSubmit } from "./NameSubmit";

export default function Page() {
  return (
    <InputView
      title="Name your account"
      description="Choose a name for your account"
    >
      <NameInput />
      <div className="flex-1" />
      <NameSubmit className="self-end" />
    </InputView>
  );
}
