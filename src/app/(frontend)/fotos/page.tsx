import { CampaignFooter } from '@/components/CampaignFooter'
import { ArchivePhotoFilters } from '@/components/fotos/ArchivePhotoFilters'
import { ArchivePhotoGrid } from '@/components/fotos/ArchivePhotoGrid'
import { ArchivePhotoHero } from '@/components/fotos/ArchivePhotoHero'
import { ArchivePhotoLightbox } from '@/components/fotos/ArchivePhotoLightbox'
import { ArchivePhotoPageHeader } from '@/components/fotos/ArchivePhotoPageHeader'
import { ArchivePhotoRemovalBand } from '@/components/fotos/ArchivePhotoRemovalBand'
import {
  ArchivePhotoEmptyState,
  ArchivePhotoNoResults,
} from '@/components/fotos/ArchivePhotoStates'
import { SelfieSearchEntry } from '@/components/fotos/SelfieSearchEntry'
import { isArchivePhotoRemovalChannelUrl } from '@/lib/archivePhotoCatalog'
import {
  ARCHIVE_PHOTO_ALBUM_PATH,
  archivePhotoAlbumActiveFilters,
  archivePhotoAlbumFacets,
  archivePhotoAlbumHeading,
  buildArchivePhotoAlbumHref,
  filterArchivePhotoAlbumItems,
  paginateArchivePhotoAlbumItems,
  parseArchivePhotoAlbumParams,
  type ArchivePhotoAlbumSearchParams,
} from '@/lib/archivePhotoPublicCatalog'
import {
  getApprovedArchivePhotoAlbumItems,
  hasPublishedArchivePhotos,
} from '@/utilities/archivePhotos/archivePhotoReads'
import { hasPublishedContentPieces } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { hasPublishedJingles } from '@/utilities/jingleReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const ALBUM_TITLE = 'Fotos do mandato — Jorge Solla 1313'
const ALBUM_DESCRIPTION =
  'Procure as fotos do mandato por data, município, atividade ou pessoa pública — só registros aprovados, com o contexto de cada momento.'

const getCachedPhotoAlbum = getCachedGlobal('photoAlbum')

/**
 * C233 — the public album: the approved photos of the mandate with the four
 * single-value facets plus a term, the overlay detail and the removal channel.
 * The `photoAlbum.published` kill switch answers the same `notFound()` for the
 * whole route; with zero approved photos the page still renders the honest
 * empty state and asks not to be indexed — nothing becomes public by accident.
 * The filtered URLs canonicalize to `/fotos`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [hasPhotos, globalMetadata, album] = await Promise.all([
    hasPublishedArchivePhotos(),
    getCachedGlobal('metadata')(),
    getCachedPhotoAlbum(),
  ])
  // The kill switch is checked here as well as in the page. The route has no
  // `loading.tsx` on purpose: a Suspense boundary flushes the shell before the
  // page resolves, and a `notFound()` thrown behind it would answer `200` with
  // the not-found UI instead of a real 404.
  if (album.published === false) notFound()
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, ARCHIVE_PHOTO_ALBUM_PATH)
  const title = `${ALBUM_TITLE} | ${siteName}`

  return {
    title,
    description: ALBUM_DESCRIPTION,
    ...(hasPhotos ? {} : { robots: { index: false, follow: false } }),
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: ALBUM_DESCRIPTION,
      images: [],
    },
    twitter: {
      card: 'summary',
      title,
      description: ALBUM_DESCRIPTION,
      creator: twitterCreator,
      images: [],
    },
  }
}

export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<ArchivePhotoAlbumSearchParams>
}) {
  const [rawSearchParams, album, showJingles, showConteudos] = await Promise.all([
    searchParams,
    getCachedPhotoAlbum(),
    hasPublishedJingles(),
    hasPublishedContentPieces(),
  ])

  if (album.published === false) notFound()

  const params = parseArchivePhotoAlbumParams(rawSearchParams)
  const approved = await getApprovedArchivePhotoAlbumItems()
  const removalChannelUrl = isArchivePhotoRemovalChannelUrl(album.removalChannelUrl)
    ? album.removalChannelUrl.trim()
    : null

  const selected =
    params.foto != null ? (approved.find((item) => item.id === params.foto) ?? null) : null
  const closeHref = buildArchivePhotoAlbumHref({ ...params, foto: null })

  const isEmptyAlbum = approved.length === 0
  const facets = archivePhotoAlbumFacets(approved)
  const filtered = isEmptyAlbum ? [] : filterArchivePhotoAlbumItems(approved, params)
  const page = paginateArchivePhotoAlbumItems(filtered, params.pagina)
  const activeFilters = archivePhotoAlbumActiveFilters(params, facets)
  const heading = archivePhotoAlbumHeading(params, facets)

  return (
    <>
      <ArchivePhotoPageHeader showConteudos={showConteudos} />
      <ArchivePhotoHero />
      <main className="w-full bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
          {isEmptyAlbum ? (
            <ArchivePhotoEmptyState />
          ) : (
            <>
              {album.selfieSearchEnabled === true ? (
                <div className="mb-8">
                  <SelfieSearchEntry />
                </div>
              ) : null}
              <ArchivePhotoFilters
                params={params}
                facets={facets}
                activeFilters={activeFilters}
                searchSecondary={album.selfieSearchEnabled === true}
              />

              <div className="mt-10 flex items-end justify-between gap-4 border-b border-(--campaign-line) pb-4">
                <div>
                  <p className="text-xs font-black tracking-[0.1em] text-(--pt-red) uppercase">
                    Álbum público
                  </p>
                  <h2 className="mt-1 font-[family-name:var(--font-exo2)] text-2xl font-black text-balance">
                    {heading}
                  </h2>
                </div>
                <span className="shrink-0 text-sm text-(--campaign-muted)">
                  Mais recentes primeiro
                </span>
              </div>

              <div className="mt-5">
                {filtered.length === 0 ? (
                  <ArchivePhotoNoResults activeFilters={activeFilters} />
                ) : (
                  <ArchivePhotoGrid page={page} params={params} />
                )}
              </div>
            </>
          )}
        </div>

        {removalChannelUrl ? <ArchivePhotoRemovalBand href={removalChannelUrl} /> : null}
      </main>
      <CampaignFooter
        showJingles={showJingles}
        showConteudos={showConteudos}
        showFotos
        current="fotos"
      />
      {selected ? (
        <ArchivePhotoLightbox
          item={selected}
          closeHref={closeHref}
          removalChannelUrl={removalChannelUrl}
        />
      ) : null}
    </>
  )
}
