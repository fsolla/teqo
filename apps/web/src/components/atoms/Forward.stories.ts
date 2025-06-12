import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Forward } from "./Forward";

const meta = {
  title: "Atoms/Forward",
  component: Forward,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Forward>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    href: "/",
  },
};
