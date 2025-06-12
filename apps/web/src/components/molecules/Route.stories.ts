import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { IconName } from "lucide-react/dynamic";
import { Route } from "./Route";

const meta = {
  title: "Molecules/Route",
  component: Route,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    icon: {
      control: "select",
      options: ["chevron-right", "file-text", "hard-drive-upload"],
    },
    variant: { control: "select", options: ["primary", "secondary"] },
  },
} satisfies Meta<typeof Route>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    icon: "chevron-right" as IconName,
    label: "Enter with Teko",
    href: "/",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    icon: "file-text" as IconName,
    label: "Import recovery phrase",
    href: "/",
  },
};

export const Terciary: Story = {
  args: {
    variant: "terciary",
    label: "Import private key",
    href: "/",
  },
};
