import { CampaignFooter } from '@/components/CampaignFooter'
import { ContentPieceCatalog } from '@/components/conteudos/ContentPieceCatalog'
import { ContentPieceFilters } from '@/components/conteudos/ContentPieceFilters'
import { ContentPieceHero } from '@/components/conteudos/ContentPieceHero'
import { ContentPiecePageHeader } from '@/components/conteudos/ContentPiecePageHeader'
import {
  ContentPieceEmptyState,
  ContentPieceNoResults,
} from '@/components/conteudos/ContentPieceStates'
import {
  CONTENT_PIECE_CATALOG_PATH,
  contentPieceCatalogActiveFilters,
  contentPieceCatalogFacets,
  contentPieceMediaKind,
  filterContentPieceCatalogItems,
  parseContentPieceCatalogParams,
  type ContentPieceCatalogSearchParams,
  type ContentPiecePublicItem,
} from '@/lib/contentPieceCatalog'
import { getPublishedContentPieceItems } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { hasPublishedJingles } from '@/utilities/jingleReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
import type { Metadata } from 'next'

const CATALOG_TITLE = 'Central de Conteúdos — Peça voto pra Solla 1313'
const CATALOG_DESCRIPTION =
  'Escolha uma peça oficial de Jorge Solla 1313, baixe ou compartilhe no WhatsApp com a mensagem de voto pronta. Sem cadastro e direto no celular.'

const isImagePiece = (item: ContentPiecePublicItem): boolean =>
  contentPieceMediaKind(item) === 'image'

/**
 * S27 — the public Central: the published pieces (C211) with the five facets,
 * the term search and the share of the vote from the card itself. Indexable
 * with its own title while there is content; zero published renders the honest
 * empty state and hides discovery (header badge and footer link), never a 404.
 * The filtered URLs canonicalize to `/conteudos`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [items, globalMetadata] = await Promise.all([
    getPublishedContentPieceItems(),
    getCachedGlobal('metadata')(),
  ])
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, CONTENT_PIECE_CATALOG_PATH)

  const firstImage = items.find(isImagePiece)
  const { url: imageUrl } = await resolveOgImage(firstImage?.file?.path)

  const title = `${CATALOG_TITLE} | ${siteName}`
  const images = imageUrl ? [{ url: imageUrl, alt: CATALOG_TITLE }] : []

  return {
    title,
    description: CATALOG_DESCRIPTION,
    ...(items.length === 0 ? { robots: { index: false, follow: false } } : {}),
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: CATALOG_DESCRIPTION,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: CATALOG_DESCRIPTION,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function ConteudosPage({
  searchParams,
}: {
  searchParams: Promise<ContentPieceCatalogSearchParams>
}) {
  const [rawSearchParams, items, showJingles] = await Promise.all([
    searchParams,
    getPublishedContentPieceItems(),
    hasPublishedJingles(),
  ])

  if (items.length === 0) {
    return (
      <>
        <ContentPiecePageHeader />
        <main className="w-full bg-white">
          <ContentPieceEmptyState />
        </main>
        <CampaignFooter showJingles={showJingles} />
      </>
    )
  }

  const params = parseContentPieceCatalogParams(rawSearchParams)
  const facets = contentPieceCatalogFacets(items)
  const filteredItems = filterContentPieceCatalogItems(items, params)
  const activeFilters = contentPieceCatalogActiveFilters(params, facets)
  const hasActiveFilters = activeFilters.length > 0

  return (
    <>
      <ContentPiecePageHeader />
      <main className="w-full bg-white">
        <ContentPieceHero />

        <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          <ContentPieceFilters params={params} facets={facets} activeFilters={activeFilters} />

          <div className="mt-9">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black tracking-[-0.02em] sm:text-2xl">
                  Escolha, compartilhe e peça voto
                </h2>
                <p className="mt-1 text-sm text-(--campaign-muted)">
                  O play só carrega a mídia quando você pedir.
                </p>
              </div>
              <span className="hidden text-sm text-(--campaign-muted) sm:inline">
                Abra o título para ver detalhes
              </span>
            </div>

            <div className="mt-5">
              {filteredItems.length > 0 ? (
                <ContentPieceCatalog items={filteredItems} showCardInvite={!hasActiveFilters} />
              ) : (
                <ContentPieceNoResults activeFilters={activeFilters} />
              )}
            </div>
          </div>
        </section>
      </main>

      <CampaignFooter showJingles={showJingles} showConteudos current="conteudos" />
    </>
  )
}
