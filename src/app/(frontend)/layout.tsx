import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { ThemeProvider } from '@/components/ThemeProvider'
import { isStagingSite } from '@/lib/siteEnvironment'
import { getCachedGlobal } from '@/utilities/globalReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { resolveSiteMetadata } from '@/utilities/seo'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import { campaignDisplayFont, campaignTextFont } from './fonts'
import './styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

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
      className={`${inter.variable} ${campaignDisplayFont.variable} ${campaignTextFont.variable} w-screen h-screen scrollbar-hide`}
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
