import { i18n } from "@/lib/i18n";
import clsx from "clsx";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { use } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teqo",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // better for performance
  variable: "--font-inter", // optional if using CSS vars
});

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  use(i18n.init());

  return (
    <html
      lang="en"
      className={clsx(
        "scrollbar-hidden h-dvh w-dvw overflow-x-hidden",
        inter.className
      )}
    >
      <body className="antialiased h-dvh w-dvw overflow-x-hidden relative scrollbar-hidden">
        {children}
      </body>
    </html>
  );
}
