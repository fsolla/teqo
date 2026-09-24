import Link from 'next/link'

import {
  CONTENT_PIECE_CATALOG_FACETS,
  CONTENT_PIECE_CATALOG_PATH,
  buildContentPieceCatalogHref,
  contentPieceCatalogFacetLabels,
  type ContentPieceCatalogActiveFilter,
  type ContentPieceCatalogFacet,
  type ContentPieceCatalogFacets,
  type ContentPieceCatalogParams,
} from '@/lib/contentPieceCatalog'

import { ContentPieceSearchMode } from './ContentPieceSearchMode'
import {
  CONTENT_PIECE_ACTIVE_CHIP,
  CONTENT_PIECE_CHIP,
  CONTENT_PIECE_FOCUS,
} from './contentPieceClasses'

const FIELD_CLASS =
  'min-h-11 w-full rounded-[10px] border border-black/18 bg-white py-2.5 pr-10 pl-3 text-[15px] text-black placeholder:text-(--campaign-muted) focus-visible:border-(--pt-red) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red) [&::-webkit-search-cancel-button]:hidden'

const DROPDOWN_LINK =
  'flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium text-black hover:bg-(--campaign-band) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red)'

/**
 * S37 — the active-filter chip is shared with the results header (design scene
 * 03): on desktop the `Lideranças` chip lives next to the contextual heading,
 * on mobile it stays in the facet row.
 */
export const ContentPieceActiveFilterChip = ({
  filter,
  className,
  prefetch,
}: {
  filter: ContentPieceCatalogActiveFilter
  className?: string
  prefetch?: boolean
}) => (
  <Link
    href={filter.removeHref}
    prefetch={prefetch}
    aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
    className={className ?? CONTENT_PIECE_ACTIVE_CHIP}
  >
    {filter.label} · {filter.value}
    <span aria-hidden="true" className="text-base leading-none">
      ×
    </span>
  </Link>
)

/**
 * S28 — the catalogue filters (artefato: cenas 07–09): a GET form (works
 * without JS, the URL is the state) with the search term, the mode segmented
 * control and one chip per facet — a `<details>` menu when empty, an active
 * chip with its removal link when set. There is no submit button: Enter on the
 * field searches and changing the mode submits. Facets that no published piece
 * carries never render; in the theme mode the links keep `prefetch={false}` so
 * a prefetched (never expanded) payload does not poison the client router
 * cache.
 */
export const ContentPieceFilters = ({
  params,
  facets,
  activeFilters,
  themeUnavailable,
}: {
  params: ContentPieceCatalogParams
  facets: ContentPieceCatalogFacets
  activeFilters: readonly ContentPieceCatalogActiveFilter[]
  themeUnavailable: boolean
}) => {
  const themeMode = params.mode === 'tema'
  const termFilter = activeFilters.find((filter) => filter.facet === 'q')
  const facetFilters = activeFilters.filter(
    (filter): filter is typeof filter & { facet: ContentPieceCatalogFacet } => filter.facet !== 'q',
  )

  return (
    <form action={CONTENT_PIECE_CATALOG_PATH} method="get">
      {CONTENT_PIECE_CATALOG_FACETS.map((facet) =>
        params[facet] ? (
          <input key={facet} type="hidden" name={facet} value={params[facet] ?? ''} />
        ) : null,
      )}

      <div className="grid gap-3 rounded-xl bg-(--campaign-cream) p-4 sm:grid-cols-[1fr_300px]">
        <div className="relative self-end">
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Encontre uma peça por assunto, cidade ou pessoa…"
            aria-label="Buscar peças"
            className={FIELD_CLASS}
          />
          {termFilter ? (
            <Link
              href={termFilter.removeHref}
              aria-label="Limpar busca"
              className={`absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-(--campaign-muted) hover:text-black ${CONTENT_PIECE_FOCUS}`}
            >
              ×
            </Link>
          ) : null}
        </div>
        <ContentPieceSearchMode mode={params.mode} themeUnavailable={themeUnavailable} />

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          {facetFilters.map((filter) => (
            <ContentPieceActiveFilterChip
              key={filter.facet}
              filter={filter}
              prefetch={themeMode ? false : undefined}
              // S37 — on desktop the Lideranças chip moves next to the results
              // heading (design scene 03); mobile keeps it in the row.
              className={
                filter.facet === 'lideranca'
                  ? `${CONTENT_PIECE_ACTIVE_CHIP} sm:hidden`
                  : CONTENT_PIECE_ACTIVE_CHIP
              }
            />
          ))}

          {CONTENT_PIECE_CATALOG_FACETS.map((facet) =>
            params[facet] || facets[facet].length === 0 ? null : (
              <details key={facet} className="relative max-sm:open:w-full">
                <summary
                  className={`${CONTENT_PIECE_CHIP} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                >
                  {contentPieceCatalogFacetLabels[facet]}
                  <span aria-hidden="true" className="text-base leading-none">
                    ⌄
                  </span>
                </summary>
                <ul
                  className={`absolute z-20 mt-1 max-h-72 list-none overflow-y-auto rounded-xl border border-(--campaign-line) bg-white p-1 shadow-[0_12px_30px_rgb(0_0_0/15%)] max-sm:static max-sm:mt-2 max-sm:w-full max-sm:min-w-0 max-sm:p-2 ${
                    facet === 'lideranca' ? 'sm:w-64' : 'min-w-44'
                  }`}
                >
                  {facet === 'lideranca' ? (
                    // S37 (design scene 03): the facet derives from published
                    // pieces alone — the caption states the rule; the mobile
                    // panel names the facet it belongs to.
                    <>
                      <li className="px-2.5 py-1 text-[10px] font-black tracking-wide text-(--campaign-muted) uppercase sm:hidden">
                        Lideranças · Em peças publicadas
                      </li>
                      <li className="hidden px-2.5 py-1 text-[10px] font-black tracking-wide text-(--campaign-muted) uppercase sm:block">
                        Em peças publicadas
                      </li>
                    </>
                  ) : null}
                  {facets[facet].map((option) => (
                    <li key={option.value}>
                      <Link
                        href={buildContentPieceCatalogHref({ ...params, [facet]: option.value })}
                        prefetch={themeMode ? false : undefined}
                        className={`${DROPDOWN_LINK}${
                          facet === 'lideranca' ? ' sm:px-3 sm:py-2' : ''
                        }`}
                      >
                        {option.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ),
          )}
        </div>
      </div>
    </form>
  )
}
