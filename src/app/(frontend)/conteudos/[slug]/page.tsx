import { CampaignFooter } from '@/components/CampaignFooter'
import { ContentPieceDetail } from '@/components/conteudos/ContentPieceDetail'
import { ContentPiecePageHeader } from '@/components/conteudos/ContentPiecePageHeader'
import { CONTENT_PIECE_CATALOG_PATH } from '@/lib/contentPieceCatalog'
import { getPublishedContentPieceBySlug } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { hasPublishedJingles } from '@/utilities/jingleReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { absoluteSitePath, resolveSiteMetadata, truncate } from '@/utilities/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const MAX_DESCRIPTION_LENGTH = 200

const fallbackDescription = (title: string): string =>
  `Peça oficial de Jorge Solla 1313: ${title}. Baixe ou compartilhe e peça voto pra Solla 1313.`

/**
 * S27 — the public page of one piece: the link opens with title and preview on
 * WhatsApp, the voter can play, download and share right there. An unpublished
 * piece, a draft and an unknown slug resolve to the same honest not-found
 * screen — the kill switch never reveals whether the piece existed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const item = await getPublishedContentPieceBySlug(slug)
  if (!item) {
    return { title: 'Esta peça não está disponível', robots: { index: false, follow: false } }
  }

  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, item.publicPath)

  const ownImage = item.file?.mimeType?.startsWith('image/') ? item.file.path : null
  const { url: imageUrl } = await resolveOgImage(ownImage)

  const title = `${item.title} | ${siteName}`
  const description = truncate(
    item.description ?? fallbackDescription(item.title),
    MAX_DESCRIPTION_LENGTH,
  )
  const images = imageUrl ? [{ url: imageUrl, alt: item.title }] : []

  return {
    title,
    description,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: item.type === 'video' ? 'video.other' : 'article',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function ContentPiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [item, showJingles] = await Promise.all([
    getPublishedContentPieceBySlug(slug),
    hasPublishedJingles(),
  ])
  if (!item) notFound()

  return (
    <>
      <ContentPiecePageHeader backHref={CONTENT_PIECE_CATALOG_PATH} />
      <main className="w-full bg-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
          <ContentPieceDetail item={item} />
        </div>
      </main>
      <CampaignFooter showJingles={showJingles} showConteudos current="conteudos" />
    </>
  )
}
