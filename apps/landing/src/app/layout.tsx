import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teqo",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // better for performance
  variable: "--font-inter", // optional if using CSS vars
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased h-dvh">{children}</body>
    </html>
  );
}
