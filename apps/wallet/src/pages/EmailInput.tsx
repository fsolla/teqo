import type { ChangeEventHandler, MouseEventHandler } from "preact/compat";
import { useRef, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";
import { post } from "../lib/post";

export const EmailInput = () => {
  const [, navigate] = useLocation();
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

    return post("/api/auth/request", { email }).then(() => {
      navigate("/input/email/confirmation", { state: { email } });
    });
  };

  return (
    <Page
      title={t("Choose your Email")}
      description={t("Enter your best email")}
    >
      <input
        ref={inputRef}
        type="email"
        name="email"
        placeholder={t("your@email.com")}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        required
        maxLength={254}
        title={t("Please enter a valid email address.")}
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

const t = getT({
  "Choose your Email": "Escolha seu Email",
  "Enter your best email": "Insira seu melhor email",
  "Please enter a valid email address.":
    "Por favor, insira um endereço de email válido.",
  "your@email.com": "seu@email.com",
});
