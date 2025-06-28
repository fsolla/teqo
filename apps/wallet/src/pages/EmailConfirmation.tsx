import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { CodeInput, useCodeInput } from "../components/molecules/CodeInput";
import { Page } from "../components/templates/Page";
import { post } from "../lib/post";
import { useCreateAccountStore } from "../stores/useCreateAccountStore";

export const EmailConfirmation = () => {
  const [, navigate] = useLocation();
  const email = useCreateAccountStore.use.email();
  const [code, setCode] = useCodeInput(["", "", "", ""]);
  const isValid = code.every((v) => v !== "");

  const handleSubmit = () => {
    if (!isValid) {
      return;
    }

    post("/api/auth/verify", { email, code: code.join("") }).then(() => {
      navigate("/input/name");
    });
  };

  return (
    <Page
      title="Confirm your Email"
      description="We've sent a confirmation code to your email."
    >
      <CodeInput value={code} setValue={setCode} />
      <Forward
        onClick={handleSubmit}
        disabled={!isValid}
        className="self-end"
      />
    </Page>
  );
};
