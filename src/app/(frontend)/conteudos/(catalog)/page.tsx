import { CampaignFooter } from '@/components/CampaignFooter'
import { ContentPieceCatalog } from '@/components/conteudos/ContentPieceCatalog'
import { ContentPieceFilters } from '@/components/conteudos/ContentPieceFilters'
import { ContentPieceHero } from '@/components/conteudos/ContentPieceHero'
import { ContentPiecePageHeader } from '@/components/conteudos/ContentPiecePageHeader'
import {
  ContentPieceEmptyState,
  ContentPieceNoResults,
  ContentPieceThemeFallbackNotice,
  ContentPieceThemeNoResults,
} from '@/components/conteudos/ContentPieceStates'
import {
  CONTENT_PIECE_CATALOG_PATH,
  buildContentPieceCatalogHref,
  contentPieceMediaKind,
  type ContentPieceCatalogSearchParams,
  type ContentPiecePublicItem,
} from '@/lib/contentPieceCatalog'
import { getPublishedContentPieceItems } from '@/utilities/content/contentPieceReads'
import { loadContentPieceCatalogSearch } from '@/utilities/content/contentPieceThemeSearch'
import { getCachedGlobal } from '@/utilities/globalReads'
import { hasPublishedJingles } from '@/utilities/jingleReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

const CATALOG_TITLE = 'Central de Conteúdos — Peça voto pra Solla 1313'
const CATALOG_DESCRIPTION =
  'Escolha uma peça oficial de Jorge Solla 1313, baixe ou compartilhe no WhatsApp com a mensagem de voto pronta. Sem cadastro e direto no celular.'

const isImagePiece = (item: ContentPiecePublicItem): boolean =>
  contentPieceMediaKind(item) === 'image'

/**
 * S27/S28 — the public Central: the published pieces (C211) with the five
 * facets, the term search (literal or by theme) and the share of the vote from
 * the card itself. Indexable with its own title while there is content; zero
 * published renders the honest empty state and hides discovery (header badge
 * and footer link), never a 404. The filtered URLs canonicalize to `/conteudos`.
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
  const [rawSearchParams, requestHeaders, showJingles] = await Promise.all([
    searchParams,
    headers(),
    hasPublishedJingles(),
  ])
  const {
    publishedCount,
    params,
    items,
    facets,
    activeFilters,
    themeMode,
    themeUnavailable,
    themeApplied,
  } = await loadContentPieceCatalogSearch({ rawSearchParams, requestHeaders })

  if (publishedCount === 0) {
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

  const hasActiveFilters = activeFilters.length > 0

  return (
    <>
      <ContentPiecePageHeader />
      <main className="w-full bg-white">
        <ContentPieceHero />

        <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          {themeUnavailable ? (
            <div className="mb-4">
              <ContentPieceThemeFallbackNotice retryHref={buildContentPieceCatalogHref(params)} />
            </div>
          ) : null}

          <ContentPieceFilters
            params={params}
            facets={facets}
            activeFilters={activeFilters}
            themeUnavailable={themeUnavailable}
          />

          <div className="mt-9">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black tracking-[-0.02em] sm:text-2xl">
                  {themeMode ? `Resultados para “${params.q}”` : 'Escolha, compartilhe e peça voto'}
                </h2>
                <p className="mt-1 text-sm text-(--campaign-muted)">
                  O play só carrega a mídia quando você pedir.
                </p>
              </div>
              {themeMode ? (
                themeApplied ? (
                  <span className="text-sm text-(--campaign-muted)">Por tema ativo</span>
                ) : null
              ) : (
                <span className="hidden text-sm text-(--campaign-muted) sm:inline">
                  Abra o título para ver detalhes
                </span>
              )}
            </div>

            <div className="mt-5">
              {items.length > 0 ? (
                <ContentPieceCatalog
                  items={items}
                  showCardInvite={!hasActiveFilters}
                  themeMode={themeMode}
                />
              ) : themeMode && !themeUnavailable ? (
                <ContentPieceThemeNoResults params={params} />
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
