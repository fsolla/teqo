import { Delete } from "lucide-react";

export type PinPadValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "Backspace";

export const PinPad = ({
  set,
  get,
  value,
}: {
  set: (pin: string) => void;
  get: () => string;
  value: PinPadValue;
}) => {
  const handleClick = () => {
    const prev = get();

    if (value === "Backspace") {
      set(prev.slice(0, -1));
    } else if (prev.length < 4) {
      set(prev + value);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="bg-teko-100 size-12.5 flex-center rounded-full"
    >
      {value === "Backspace" ? <Delete size={30} /> : null}
      {value !== "Backspace" ? <h1>{value}</h1> : null}
    </button>
  );
};
