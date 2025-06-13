import { InputView } from "../InputView";
import { CodeInput } from "./CodeInput";
import { CodeSubmit } from "./CodeSubmit";

export default function Page() {
  return (
    <InputView
      title="Confirm your Email"
      description="We've sent a confirmation code to your email"
    >
      <div className="flex gap-6 h-17.5 self-center w-fit">
        <CodeInput index={0} />
        <CodeInput index={1} />
        <CodeInput index={2} />
        <CodeInput index={3} />
      </div>
      <CodeSubmit />
    </InputView>
  );
}
