import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignPageHeader } from '@/components/CampaignPageHeader'
import { JingleEmptyState } from '@/components/jingles/JingleEmptyState'
import { JingleIntro } from '@/components/jingles/JingleIntro'
import { JinglePlayer } from '@/components/jingles/JinglePlayer'
import { hasPublishedContentPieces } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { getPublishedJingleItems } from '@/utilities/jingleReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
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

  const { url: imageUrl } = await resolveOgImage(items[0]?.coverUrl)

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
  const [items, showConteudos] = await Promise.all([
    getPublishedJingleItems(),
    hasPublishedContentPieces(),
  ])
  const hasItems = items.length > 0

  return (
    <>
      <CampaignPageHeader badge={hasItems ? 'Jingles oficiais' : undefined} />
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
      <CampaignFooter showJingles={hasItems} showConteudos={showConteudos} current="jingles" />
    </>
  )
}
