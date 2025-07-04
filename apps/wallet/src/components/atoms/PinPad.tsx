import { Delete } from "lucide-preact";
import type { Dispatch, StateUpdater } from "preact/hooks";

export const PinPad = ({
  set,
  value,
}: {
  set: Dispatch<StateUpdater<string>>;
  value:
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
}) => {
  const handleClick = () => {
    set((prev) => {
      if (value === "Backspace") {
        return prev.slice(0, -1);
      } else if (prev.length < 4) {
        return prev + value;
      }

      return prev;
    });
  };

  return (
    <button
      onClick={handleClick}
      className="bg-teqo-100 size-12.5 flex-center rounded-full"
    >
      {value === "Backspace" ? <Delete size={30} /> : null}
      {value !== "Backspace" ? <h1>{value}</h1> : null}
    </button>
  );
};
