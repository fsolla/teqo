import { CampaignFooter } from '@/components/CampaignFooter'
import { JingleEmptyState } from '@/components/jingles/JingleEmptyState'
import { JingleIntro } from '@/components/jingles/JingleIntro'
import { JinglePageHeader } from '@/components/jingles/JinglePageHeader'
import { JinglePlayer } from '@/components/jingles/JinglePlayer'
import type { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { getPublishedJingleItems } from '@/utilities/jingleReads'
import {
  absoluteSitePath,
  resolveDeploymentOrigin,
  resolveSiteMetadata,
  toAbsoluteUrl,
} from '@/utilities/seo'
import type { Metadata } from 'next'

const JINGLES_PATH = '/jingles'
const JINGLES_TITLE = 'Jingles de Jorge Solla'
const JINGLES_DESCRIPTION =
  'Ouça aqui mesmo e baixe os jingles oficiais de Jorge Solla 1313. Grátis, sem cadastro e direto no celular.'

/**
 * S21 — the public jingles page: the published pieces with cover, in-page
 * player and MP3 download. Indexable with its own title/description while
 * there is content; zero published renders the honest empty state and hides
 * discovery (footer link + header badge), never a 404.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [items, globalMetadata] = await Promise.all([
    getPublishedJingleItems(),
    getCachedGlobal('metadata')(),
  ])
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, JINGLES_PATH)
  const deploymentOrigin = resolveDeploymentOrigin(siteUrl)

  // The media proxy only exists on the deployment origin (the global URL may be
  // a canonical domain served elsewhere), same rule as the share-link OG image.
  const coverUrl =
    items[0] && deploymentOrigin ? toAbsoluteUrl(items[0].coverUrl, deploymentOrigin) : undefined

  let fallbackImage: Media | null = null
  if (!coverUrl && globalMetadata.image) {
    fallbackImage =
      typeof globalMetadata.image === 'number'
        ? await getCachedDocumentById('media', String(globalMetadata.image))()
        : globalMetadata.image
  }

  const imageUrl =
    coverUrl ??
    (fallbackImage?.url && deploymentOrigin
      ? toAbsoluteUrl(fallbackImage.url, deploymentOrigin)
      : undefined)
  const title = `${JINGLES_TITLE} | ${siteName}`
  const images = imageUrl ? [{ url: imageUrl, alt: items[0]?.coverAlt ?? JINGLES_TITLE }] : []

  return {
    title,
    description: JINGLES_DESCRIPTION,
    ...(items.length === 0 ? { robots: { index: false, follow: false } } : {}),
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: JINGLES_DESCRIPTION,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: JINGLES_DESCRIPTION,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function JinglesPage() {
  const items = await getPublishedJingleItems()
  const hasItems = items.length > 0

  return (
    <>
      <JinglePageHeader withBadge={hasItems} />
      <main className="w-full bg-white">
        {hasItems ? (
          <>
            <JingleIntro />
            <JinglePlayer jingles={items} />
          </>
        ) : (
          <JingleEmptyState />
        )}
      </main>
      <CampaignFooter showJingles={hasItems} current="jingles" />
    </>
  )
}
