import 'server-only'

import {
  cardCatalogItems,
  contentCatalogItems,
  contentPieceCatalogActiveFilters,
  contentPieceCatalogFacets,
  contentPieceThemeTerms,
  filterContentPieceCatalogItems,
  parseContentPieceCatalogParams,
  toContentPiecePublicItem,
  type ContentCatalogItem,
  type ContentPieceCatalogActiveFilter,
  type ContentPieceCatalogFacets,
  type ContentPieceCatalogParams,
  type ContentPieceCatalogSearchParams,
  type ContentPiecePublicItem,
} from '@/lib/contentPieceCatalog'
import {
  expandContentPieceSearchTheme,
  type ThemeSearchExpansionResolver,
} from '@/utilities/ai/expandSpeechSearchTheme'
import {
  resolveGuardedThemeExpansion,
  type ThemeSearchHeaders,
} from '@/utilities/ai/themeSearchGuard'
import { getPublishedContentPieceRecords } from '@/utilities/content/contentPieceReads'
import { headers } from 'next/headers'

/**
 * S28 — the public catalogue search, both modes. The literal search is the
 * default and the theme mode is an OR over the literal query plus the expanded
 * terms, over the SAME cached published records the S27 surface reads. The
 * expansion only runs for `mode=tema` with a query, only when the Central has
 * something published, and always through the anonymous guard (limit +
 * eligibility + cache): the caller renders the discreet notice whenever it
 * resolves `null`.
 *
 * S38 — the same loader appends the six synthetic card items to the board (and
 * only there): facets and filter below see one union, so Tipo "Card" and the
 * nickname search work without a second pipeline.
 */
export type ContentPieceCatalogSearchData = {
  /**
   * Public pieces on the Central before filters: zero renders the honest empty
   * state. S38 — cards never count here (they only ride along a non-empty
   * Central), so the guardrail of the empty state is this number alone.
   */
  publishedCount: number
  params: ContentPieceCatalogParams
  items: ContentCatalogItem[]
  facets: ContentPieceCatalogFacets
  activeFilters: ContentPieceCatalogActiveFilter[]
  /** The actor asked for the theme mode (always with a query): the badges state the provenance. */
  themeMode: boolean
  /** The actor asked for `mode=tema` but the mechanism was unavailable: degrade with the notice. */
  themeUnavailable: boolean
  /** The expansion actually contributed terms (an empty list is not "applied"). */
  themeApplied: boolean
}

const toPublicItems = (
  records: Awaited<ReturnType<typeof getPublishedContentPieceRecords>>,
  themeTerms: readonly string[] = [],
): ContentPiecePublicItem[] =>
  records
    .map((record) => toContentPiecePublicItem(record, { themeTerms }))
    .filter((item): item is ContentPiecePublicItem => item !== null)

/** The request headers via the dynamic API, imported here so the page stays static-ish. */
const headersFromRequest = async (): Promise<ThemeSearchHeaders> => (await headers()) as Headers

export const loadContentPieceCatalogSearch = async ({
  rawSearchParams,
  requestHeaders,
  expandTheme = expandContentPieceSearchTheme,
}: {
  rawSearchParams: ContentPieceCatalogSearchParams
  /**
   * The request headers the anonymous guard reads. Optional: the page omits it
   * and the loader reads `next/headers` ONLY on the theme path — the literal
   * catalogue must not opt the render into the dynamic API, which defers the
   * whole page behind the `loading.tsx` boundary (streamed into a hidden div)
   * and leaves a transient duplicate of the DOM in the production build.
   */
  requestHeaders?: ThemeSearchHeaders
  expandTheme?: ThemeSearchExpansionResolver
}): Promise<ContentPieceCatalogSearchData> => {
  const records = await getPublishedContentPieceRecords()
  const params = parseContentPieceCatalogParams(rawSearchParams)
  const publishedItems = toPublicItems(records)

  const themeRequested = params.mode === 'tema'
  let themeTerms: string[] = []
  let themeUnavailable = false

  // An empty Central has nothing to search: never pay for an expansion there.
  if (themeRequested && publishedItems.length > 0) {
    const headers = requestHeaders ?? (await headersFromRequest())
    const expansion = await resolveGuardedThemeExpansion({
      q: params.q,
      headers,
      expandTheme,
    })
    if (expansion) themeTerms = contentPieceThemeTerms(params.q, expansion.terms)
    else themeUnavailable = true
  }

  const publicItems = themeTerms.length > 0 ? toPublicItems(records, themeTerms) : publishedItems
  // S38 — the six card models are synthetic items of the same board, appended
  // only while the Central has published pieces (the guard lives in the pure
  // builder): an empty Central keeps the honest empty state, never a board of
  // cards.
  const catalogItems = contentCatalogItems(publicItems, publishedItems.length, cardCatalogItems())
  const facets = contentPieceCatalogFacets(catalogItems)

  return {
    publishedCount: publishedItems.length,
    params,
    items: filterContentPieceCatalogItems(catalogItems, params, themeTerms),
    facets,
    activeFilters: contentPieceCatalogActiveFilters(params, facets),
    themeMode: themeRequested,
    themeUnavailable,
    themeApplied: themeTerms.length > 0,
  }
}
