import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teqo",
  description:
    "Your keys, your crypto. A self-custodial Web3 wallet built for clarity, flow, and dignity.",
  metadataBase: new URL("https://teqo.app"),
  openGraph: {
    title: "Teqo",
    description:
      "Your keys, your crypto. A self-custodial Web3 wallet built for clarity, flow, and dignity.",
    url: "https://teqo.app",
    siteName: "Teqo",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teqo",
    description:
      "Your keys, your crypto. A self-custodial Web3 wallet built for clarity, flow, and dignity.",
  },
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
  return (
    <html lang="en" className={`${inter.className}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
