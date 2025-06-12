import { QueryClientProvider } from "@/lib/QueryClientProvider";
import { WagmiProvider } from "@/lib/WagmiProvider";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYCELIA",
  description:
    "Tap into the network. Mycelia is a personal Web3 playground built with Next.js, wagmi, and viem.",
  metadataBase: new URL("https://mycelia.solla.dev"),
  openGraph: {
    title: "Mycelia",
    description:
      "Tap into the network. Mycelia is a personal Web3 playground built with Next.js, wagmi, and viem.",
    url: "https://mycelia.solla.dev",
    siteName: "Mycelia",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Mycelia Open Graph Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mycelia",
    description:
      "Tap into the network. A Web3 playground powered by Next.js, wagmi, and viem.",
    images: ["/og.png"],
    creator: "@franciscosolla",
  },
  icons: {
    icon: [
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" },
    ],
    apple: [
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" },
    ],
  },
  manifest: "/site.webmanifest",
  category: "technology",
  generator: "Next.js",
  authors: [{ name: "Francisco Solla", url: "https://solla.dev" }],
  creator: "Francisco Solla",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WagmiProvider>
      <QueryClientProvider>
        <html lang="en">
          <body className="antialiased h-dvh overflow-hidden bg-teko-50 relative text-teko-900 max-w-113 mx-auto caret-tint">
            {children}
          </body>
        </html>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
