import { Redirect, useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { CodeInput, useCodeInput } from "../components/molecules/CodeInput";
import { Page } from "../components/templates/Page";
import { post } from "../lib/post";

export const EmailConfirmation = () => {
  const [, navigate] = useLocation();
  const [code, setCode] = useCodeInput(["", "", "", ""]);
  const isValid = code.every((v) => v !== "");

  const email = history.state?.email;

  if (!email) {
    return <Redirect to="/input/email" />;
  }

  const handleSubmit = () => {
    if (!email || !isValid) {
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
      <div className="flex-1" />
      <Forward
        onClick={handleSubmit}
        disabled={!isValid}
        className="self-end"
      />
    </Page>
  );
};
