import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ThemeProvider } from '@/components/ThemeProvider'
import { isStagingSite } from '@/lib/siteEnvironment'
import { getCachedGlobal } from '@/utilities/globalReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { resolveSiteMetadata } from '@/utilities/seo'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Metadata } from 'next'
import { Arimo, Exo_2, Inter } from 'next/font/google'
import React from 'react'
import './styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
// Campanha 2026: Exo 2 para display (títulos/CTAs) e Arimo para cards/tags —
// mesmo uso das peças do Penpot e do santinho. OFL, self-hosted pelo next/font.
const exo2 = Exo_2({ subsets: ['latin'], variable: '--font-exo2' })
const arimo = Arimo({ subsets: ['latin'], variable: '--font-arimo' })

export async function generateMetadata(): Promise<Metadata> {
  const payload = await getCachedGlobal('metadata')()
  const { siteUrl, title, description, siteName, twitterCreator, twitterDescription, keywords } =
    resolveSiteMetadata(payload)

  const { url: imageUrl, media } = await resolveOgImage(null)

  return {
    title,
    description,
    keywords,
    authors: [
      { name: 'Francisco Solla', url: 'https://solla.dev' },
      { name: 'Teqo', url: 'https://teqo.app' },
    ],
    creator: 'Francisco Solla',
    publisher: 'Teqo',
    robots: isStagingSite() ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(siteUrl ? { url: siteUrl } : {}),
      siteName,
      title,
      description,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: media?.width ?? undefined,
              height: media?.height ?? undefined,
              alt: media?.alt,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: twitterDescription,
      creator: twitterCreator,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${exo2.variable} ${arimo.variable} w-screen h-screen scrollbar-hide`}
      style={{ colorScheme: 'light' }}
      suppressHydrationWarning
    >
      <body className="antialiased w-screen scrollbar-hide overflow-hidden">
        <ThemeProvider attribute="class">
          {process.env.VERCEL === '1' ? (
            <>
              <SpeedInsights />
              <Analytics />
            </>
          ) : null}
          <RefreshRouteOnSave />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
