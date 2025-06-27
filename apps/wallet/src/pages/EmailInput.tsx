import type { ChangeEventHandler, MouseEventHandler } from "preact/compat";
import { useRef, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";
import { post } from "../lib/post";
import { useCreateAccountStore } from "../stores/useCreateAccountStore";

export const EmailInput = () => {
  const [, navigate] = useLocation();
  const setEmail = useCreateAccountStore.use.setEmail();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isValid, setIsValid] = useState(false);

  const handleInput: ChangeEventHandler<HTMLInputElement> = (e) => {
    setIsValid(e.currentTarget.validity.valid);
  };

  const handleSubmit: MouseEventHandler<HTMLButtonElement> = () => {
    if (!inputRef.current?.validity.valid) {
      return;
    }

    const email = inputRef.current.value.trim().toLowerCase();

    post("/api/auth/eligible", { email }).then(({ eligible }) => {
      if (eligible) {
        setEmail(email);
        navigate("/input/email/confirmation");
      }
    });
  };

  return (
    <Page title="Choose your Email" description="Enter your best email">
      <input
        ref={inputRef}
        type="email"
        name="email"
        placeholder="your@email.com"
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        required
        onChange={handleInput}
      />
      <div className="flex-1" />
      <Forward
        onClick={handleSubmit}
        disabled={!isValid}
        className="self-end"
      />
    </Page>
  );
};
