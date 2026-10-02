import { ChevronDown, SearchIcon } from 'lucide-react'
import Link from 'next/link'

import {
  ARCHIVE_PHOTO_ALBUM_FACETS,
  ARCHIVE_PHOTO_ALBUM_PATH,
  archivePhotoAlbumFacetLabels,
  buildArchivePhotoAlbumHref,
  type ArchivePhotoAlbumActiveFilter,
  type ArchivePhotoAlbumFacet,
  type ArchivePhotoAlbumFacets,
  type ArchivePhotoAlbumParams,
} from '@/lib/archivePhotoPublicCatalog'

import { ArchivePhotoFiltersSheet } from './ArchivePhotoFiltersSheet'
import {
  ARCHIVE_PHOTO_ACTIVE_CHIP,
  ARCHIVE_PHOTO_CHIP,
  ARCHIVE_PHOTO_FOCUS,
  ARCHIVE_PHOTO_PRIMARY_BUTTON,
  ARCHIVE_PHOTO_SECONDARY_BUTTON,
} from './archivePhotoClasses'

const FACET_MENU_HEADINGS: Record<ArchivePhotoAlbumFacet, string> = {
  data: 'Dias com fotos publicadas',
  municipio: 'Municípios com fotos',
  atividade: 'Atividades',
  pessoa: 'Figuras reconhecidas com curadoria',
}

const FIELD_CLASS =
  'min-h-12 w-full rounded-[10px] border border-black/20 bg-white py-2.5 pr-4 pl-11 text-[15px] text-black placeholder:text-(--campaign-muted) focus-visible:border-(--pt-red) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red)'

const DROPDOWN_LINK =
  'flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-black hover:bg-(--campaign-band) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red)'

type FacetFilter = ArchivePhotoAlbumActiveFilter & { facet: ArchivePhotoAlbumFacet }

const ActiveChips = ({ filters }: { filters: readonly FacetFilter[] }) => (
  <>
    {filters.map((filter) => (
      <Link
        key={filter.facet}
        href={filter.removeHref}
        aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
        className={ARCHIVE_PHOTO_ACTIVE_CHIP}
      >
        {filter.label} · {filter.value}
        <span aria-hidden="true" className="text-base leading-none">
          ×
        </span>
      </Link>
    ))}
  </>
)

const ClearFiltersLink = ({ className }: { className?: string }) => (
  <Link
    href={ARCHIVE_PHOTO_ALBUM_PATH}
    className={`inline-flex min-h-11 items-center rounded-sm text-sm font-extrabold text-[#184e92] underline-offset-4 hover:underline ${ARCHIVE_PHOTO_FOCUS} ${className ?? ''}`}
  >
    Limpar filtros
  </Link>
)

/**
 * C233 — the album filters (artefato: cenas 01/02): a GET form (works without
 * JS, the URL is the state) with the term field, the active chips (each with
 * its removal link) and one `<details>` menu per facet on desktop — the
 * exclusive accordion shares one `name`. On mobile the active chips + the clear
 * link stay visible and the facets move into the bottom sheet (the trigger is
 * the only client piece; the menus never render for a facet no approved photo
 * carries).
 */
export const ArchivePhotoFilters = ({
  params,
  facets,
  activeFilters,
  searchSecondary = false,
}: {
  params: ArchivePhotoAlbumParams
  facets: ArchivePhotoAlbumFacets
  activeFilters: readonly ArchivePhotoAlbumActiveFilter[]
  /** C234 — with the selfie entry band above, the album search is the secondary action. */
  searchSecondary?: boolean
}) => {
  const facetFilters = activeFilters.filter((filter): filter is FacetFilter => filter.facet !== 'q')
  const termFilter = activeFilters.find((filter) => filter.facet === 'q')

  return (
    <>
      <form
        action={ARCHIVE_PHOTO_ALBUM_PATH}
        method="get"
        className="rounded-2xl bg-(--campaign-cream) p-4 sm:p-5"
      >
        {ARCHIVE_PHOTO_ALBUM_FACETS.map((facet) =>
          params[facet] ? (
            <input key={facet} type="hidden" name={facet} value={params[facet] ?? ''} />
          ) : null,
        )}

        <label htmlFor="album-search" className="text-sm font-extrabold">
          O que você procura?
        </label>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-(--campaign-muted)"
            />
            <input
              id="album-search"
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Ex.: plenária de saúde em município"
              className={FIELD_CLASS}
            />
            {termFilter ? (
              <Link
                href={termFilter.removeHref}
                aria-label="Limpar busca"
                className={`absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-(--campaign-muted) hover:text-black ${ARCHIVE_PHOTO_FOCUS}`}
              >
                ×
              </Link>
            ) : null}
          </div>
          <button
            type="submit"
            className={`${searchSecondary ? ARCHIVE_PHOTO_SECONDARY_BUTTON : ARCHIVE_PHOTO_PRIMARY_BUTTON} min-w-28`}
          >
            Buscar fotos
          </button>
        </div>

        <div
          className="mt-4 hidden flex-wrap items-start gap-2 sm:flex"
          role="group"
          aria-label="Filtros"
        >
          <ActiveChips filters={facetFilters} />

          {ARCHIVE_PHOTO_ALBUM_FACETS.map((facet) =>
            params[facet] || facets[facet].length === 0 ? null : (
              <details key={facet} name="album-facet" className="group relative">
                <summary
                  className={`${ARCHIVE_PHOTO_CHIP} cursor-pointer list-none group-open:border-[#184e92]/35 group-open:text-[#184e92] [&::-webkit-details-marker]:hidden`}
                >
                  {archivePhotoAlbumFacetLabels[facet]}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <ul className="absolute z-20 mt-2 max-h-72 min-w-48 list-none overflow-y-auto rounded-xl border border-(--campaign-line) bg-white p-1.5 shadow-[0_14px_34px_rgb(0_0_0/16%)]">
                  <li className="px-3 py-1.5 text-[10px] font-black tracking-[0.08em] text-(--campaign-muted) uppercase">
                    {FACET_MENU_HEADINGS[facet]}
                  </li>
                  {facets[facet].map((option) => (
                    <li key={option.value}>
                      <Link
                        href={buildArchivePhotoAlbumHref({
                          ...params,
                          foto: null,
                          [facet]: option.value,
                        })}
                        className={DROPDOWN_LINK}
                      >
                        {option.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ),
          )}

          {activeFilters.length > 0 ? <ClearFiltersLink className="ml-auto self-center" /> : null}
        </div>
      </form>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 sm:hidden"
        role="group"
        aria-label="Filtros"
      >
        <ArchivePhotoFiltersSheet
          params={params}
          facets={facets}
          activeCount={facetFilters.length}
        />
        <ActiveChips filters={facetFilters} />
        {activeFilters.length > 0 ? <ClearFiltersLink /> : null}
      </div>
    </>
  )
}
