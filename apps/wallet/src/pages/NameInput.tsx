import type { ChangeEventHandler } from "preact/compat";
import { useRef, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Forward } from "../components/atoms/Forward";
import { Page } from "../components/templates/Page";
import { getT } from "../lib/i18n";

export const NameInput = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isValid, setIsValid] = useState(false);
  const [_, navigate] = useLocation();

  const handleInput: ChangeEventHandler<HTMLInputElement> = (e) => {
    setIsValid(e.currentTarget.validity.valid);
  };

  const handleSubmit: ChangeEventHandler<HTMLButtonElement> = async () => {
    const name = inputRef.current?.value.trim();

    if (name) {
      navigate("/input/pin", { state: { name } });
    }
  };

  return (
    <Page
      title={t("Name your account")}
      description={t("Choose a name for your account")}
    >
      <input
        ref={inputRef}
        type="text"
        name="name"
        placeholder={t("Account name")}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        required
        pattern="^(?=.{3,})\S+(\s\S+)*$"
        title={t(
          "Name must be at least 3 characters, with no leading, trailing, or double spaces."
        )}
        onChange={handleInput}
        maxLength={50}
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
  "Name your account": "Nomeie sua conta",
  "Choose a name for your account": "Escolha um nome para sua conta",
  "Account name": "Nome da conta",
  "Name must be at least 3 characters, with no leading, trailing, or double spaces.":
    "O nome deve ter pelo menos 3 caracteres, sem espaços iniciais, finais ou duplos.",
});
