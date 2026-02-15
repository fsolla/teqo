import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import React from 'react'
import './styles.css'
import { RefreshRouteOnSave } from '@/utilities/RefreshRouteOnSave'
import { Metadata } from 'next'
import { getCachedGlobal } from '@/utilities/globals'
import { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documents'

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
    <html lang="pt-BR">
      <body>
        <RefreshRouteOnSave />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
