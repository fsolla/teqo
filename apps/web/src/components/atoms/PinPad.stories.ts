import type { StoryObj } from "@storybook/nextjs-vite";
import { PinPad } from "./PinPad";

export const meta = {
  title: "Atoms/PinPad",
  component: PinPad,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    set: { control: "function" },
    get: { control: "function" },
    value: {
      control: "select",
      options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "Backspace"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = (() => {
  const store = { pin: "" };

  return {
    args: {
      set: (pin: string) => {
        store.pin = pin;
        console.log("Set pin:", pin);
      },
      get: () => store.pin,
      value: "0",
    },
  };
})();
