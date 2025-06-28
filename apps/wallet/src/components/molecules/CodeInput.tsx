import clsx from "clsx";
import {
  useState,
  type ChangeEventHandler,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
} from "preact/compat";

export const CodeInput = <Value extends string[]>({
  value,
  setValue,
}: {
  value: Value;
  setValue: (index: number, value: string) => void;
}) => {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const index = Number(e.currentTarget.id.split("-").pop());

    const value = e.currentTarget.value.replaceAll(/[^0-9]/g, "");

    setValue(index, value[0] || "");

    if (value.length > 1) {
      let i = 1;
      while (value[i] && getInput(index + i)) {
        setValue(index + i, value[i] ?? "");
        i += 1;
      }

      if (getInput(index + i)) {
        goToInput(index + i);
      } else {
        goToInput(index + i - 1);
      }
    }
  };

  return (
    <div className="flex gap-6 h-17.5 self-center w-fit">
      {value.map((v, i) => (
        <KeyInput key={i} id={i} value={v} onChange={handleChange} />
      ))}
    </div>
  );
};

const KeyInput = ({
  value,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id"> & {
  value?: string | null;
  id: number;
}) => {
  return (
    <input
      id={`email-confirmation-code-${id}`}
      type="text"
      name="code"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="none"
      required
      className={clsx(
        "border rounded-2xl text-center outline-hidden text-h1 w-12.5",
        value?.length ? "border-tint" : "border-teqo-200"
      )}
      pattern="^[0-9]$"
      value={value ?? ""}
      onKeyDown={handleKeyDown}
      {...props}
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

const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
  const index = Number(e.currentTarget.id.split("-").pop());

  if (e.key === "ArrowLeft" && index > 0) {
    goToPreviousInput(index);
  }

  if (["ArrowRight", "Enter"].includes(e.key)) {
    goToNextInput(index);
  }

  if (e.key === "Backspace" && e.currentTarget.value === "") {
    goToPreviousInput(index);
  }

  if (e.key === "Delete" && e.currentTarget.value === "") {
    goToNextInput(index);
  }
};

export const useCodeInput = <Value extends string[]>(initialState: Value) => {
  const [code, set] = useState(initialState);

  const setCode = (index: number, value: Value[number]) =>
    set((prev) => {
      const newCode = [...prev];
      newCode[index] = value;
      return newCode as Value;
    });

  return [code, setCode] as const;
};
