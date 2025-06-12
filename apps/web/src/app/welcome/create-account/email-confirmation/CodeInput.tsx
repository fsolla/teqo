"use client";
import clsx from "clsx";
import type { ChangeEventHandler, KeyboardEventHandler } from "react";
import { useCreateAccountStore } from "../useCreateAccountStore";

export const CodeInput = ({
  index,
  autoFocus,
}: {
  index: number;
  autoFocus?: true;
}) => {
  const emailCode = useCreateAccountStore((state) => state.emailCode[index]);
  const setEmailCode = useCreateAccountStore.use.setEmailCode();

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value.replaceAll(/[^0-9]/g, "");

    setEmailCode(value[0] || "", index);

    let i = 1;
    while (value[i] && getInput(index + i)) {
      setEmailCode(value[i] ?? "", index + i);
      i += 1;
    }

    if (getInput(index + i)) {
      goToInput(index + i);
    } else {
      goToInput(index + i - 1);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowLeft" && index > 0) {
      goToPreviousInput(index);
    }

    if (["ArrowRight", "Enter"].includes(e.key)) {
      goToNextInput(index);
    }

    if (["Backspace", "Delete"].includes(e.key)) {
      setEmailCode("", index);
    }

    if (e.key === "Backspace" && e.currentTarget.value === "") {
      goToPreviousInput(index);
    }

    if (e.key === "Delete" && e.currentTarget.value === "") {
      goToNextInput(index);
    }
  };

  return (
    <input
      id={`email-confirmation-code-${index}`}
      type="text"
      name="code"
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      autoComplete="none"
      required
      className={clsx(
        "border rounded-2xl text-center outline-hidden text-h1 w-12.5",
        emailCode?.length ? "border-tint" : "border-teko-200"
      )}
      pattern="^[0-9]$"
      value={emailCode ?? ""}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
    />
  );
};

const getInput = (id: number) =>
  document.getElementById(
    `email-confirmation-code-${id}`
  ) as HTMLInputElement | null;

const goToInput = (index: number) =>
  setTimeout(() => getInput(index)?.select(), 0);

const goToPreviousInput = (index: number) => goToInput(index - 1);

const goToNextInput = (index: number) => goToInput(index + 1);
