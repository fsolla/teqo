import { getCachedDocumentById } from '@/utilities/documents'
import { getCachedGlobal } from '@/utilities/globals'
import { RefreshRouteOnSave } from '@/utilities/RefreshRouteOnSave'
import { Metadata } from 'next'
import React from 'react'
import './styles.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export async function generateMetadata(): Promise<Metadata> {
  const payload = await getCachedGlobal('metadata')()

  let image = payload.image

  if (typeof image === 'number') {
    image = await getCachedDocumentById('media', String(payload.image))()
  }

  return {
    title: payload.title,
    description: payload.description,
    keywords: payload.keywords.filter((keyword) => typeof keyword === 'string'),
    authors: [
      { name: 'Francisco Solla', url: 'https://solla.dev' },
      { name: 'Teqo', url: 'https://teqo.app' },
    ],
    creator: 'Francisco Solla',
    publisher: 'Teqo',
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      url: payload.URL,
      siteName: payload.openGraph.siteName,
      title: payload.title,
      description: payload.description,
      images: image?.url
        ? [
            {
              url: image.url,
              width: image.width!,
              height: image.height!,
              alt: image.alt,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: payload.title,
      description: payload.twitter.description,
      creator: payload.twitter.creator,
      images: image?.url ? [image.url] : [],
    },
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} w-screen h-screen scrollbar-hide`}
      style={{ colorScheme: 'light' }}
      suppressHydrationWarning
    >
      <body className="antialiased w-screen scrollbar-hide overflow-hidden">
        <ThemeProvider attribute="class">
          <SpeedInsights />
          <Analytics />
          <RefreshRouteOnSave />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
