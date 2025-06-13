import { InputView } from "../InputView";
import { EmailInput } from "./EmailInput";
import { EmailSubmit } from "./EmailSubmit";

export default function Page() {
  return (
    <InputView title="Choose your Email" description="Enter your best email">
      <EmailInput />
      <div className="flex-1" />
      <EmailSubmit className="self-end" />
    </InputView>
  );
}
