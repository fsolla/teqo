/**
 * Campaign updates feed URL contract (C89): state type, param
 * parsing/canonicalization, Payload `where` and serialization — the page-level
 * counterpart of `municipalityListUrl.ts` for the read-only feed of updates
 * across the actor's portfolio. The URL contract is deliberately canonical and
 * frozen-in-shape so a later saved-filters feature (B18 family) can build on it
 * without a contract break.
 *
 * URL params (all optional): `page`, `q` (text search on body), `slug`
 * (municipality slugs, multi OR), `polarity` (boa|neutra|ruim, multi OR,
 * "todas" canonicalizes to absent), `urgent` (exclusive boolean toggle) and
 * `author` (campaignUser ids, multi OR).
 *
 * The `municipalityUpdate` collection only keeps the `municipality`
 * relationship by DB id, but the municipality slugs are filtered through the
 * relationship's own `slug` field (dotted path) — pure, fail-closed (an
 * unknown slug filters to nothing instead of widening), and the same
 * relationship-slug filtering the rest of the codebase uses.
 */
import type { Where } from 'payload'

import { isMunicipalitySlug } from '@/lib/municipalityCatalog'
import {
  municipalityUpdatePolarities,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const campaignUpdatesFeedPageSize = 20

export type CampaignUpdatesFeedState = {
  page: number
  /** Free-text search over the update `body` (not author/municipality name). */
  q?: string
  /** Multi-select (OR) municipality catalog slugs. */
  slugs?: string[]
  /**
   * Multi-select (OR) polarities. Never holds the full set: "todas" is encoded
   * as absent, canonicalized by `parseCampaignUpdatesFeedParams`.
   */
  polarities?: MunicipalityUpdatePolarity[]
  /** Exclusive boolean toggle — true only when filtering urgent updates. */
  urgent?: boolean
  /** Multi-select (OR) campaignUser author ids. */
  authors?: number[]
}

const campaignUpdatesFeedParamNames = [
  'q',
  'slug',
  'polarity',
  'urgent',
  'author',
  'page',
] as const

const campaignUpdatesFeedParamNameSet = new Set<string>(campaignUpdatesFeedParamNames)

const municipalityUpdatePolaritySet = new Set<string>(municipalityUpdatePolarities)

const parseSlugsParam = (raw: string | string[] | undefined): string[] => {
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const token of allParamValues(raw)) {
    if (!isMunicipalitySlug(token) || seen.has(token)) continue
    seen.add(token)
    slugs.push(token)
  }
  return slugs
}

const parseAuthorsParam = (raw: string | string[] | undefined): number[] => {
  const authors: number[] = []
  const seen = new Set<number>()
  for (const token of allParamValues(raw)) {
    const id = strictDecimalInteger(token)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    authors.push(id)
  }
  return authors.sort((left, right) => left - right)
}

const campaignUpdatesFeedStateToRawParams = (
  state: CampaignUpdatesFeedState,
  page = state.page,
): RawSearchParams => ({
  page: String(page),
  q: state.q,
  slug: state.slugs,
  polarity: state.polarities,
  urgent: state.urgent ? 'true' : undefined,
  author: state.authors?.map(String),
})

export const parseCampaignUpdatesFeedParams = (
  params: RawSearchParams,
): CampaignUpdatesFeedState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const slugs = parseSlugsParam(params.slug)
  const polarities = parseExhaustiveEnumParam<MunicipalityUpdatePolarity>(
    params.polarity,
    municipalityUpdatePolaritySet,
  )
  const urgent = firstValue(params.urgent) === 'true'
  const authors = parseAuthorsParam(params.author)

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(slugs.length ? { slugs } : {}),
    ...(polarities.length ? { polarities } : {}),
    ...(urgent ? { urgent } : {}),
    ...(authors.length ? { authors } : {}),
  }
}

/**
 * Serializes a state that is ALREADY canonical (came out of
 * `parseCampaignUpdatesFeedParams`, or was derived from a canonical state by a
 * rule-preserving toggle).
 */
export const serializeCanonicalCampaignUpdatesFeedSearchParams = (
  canonicalState: CampaignUpdatesFeedState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const slug of canonicalState.slugs ?? []) params.append('slug', slug)
  for (const polarity of canonicalState.polarities ?? []) params.append('polarity', polarity)
  if (canonicalState.urgent) params.set('urgent', 'true')
  for (const author of canonicalState.authors ?? []) params.append('author', String(author))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildCampaignUpdatesFeedSearchParams = (
  state: CampaignUpdatesFeedState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalCampaignUpdatesFeedSearchParams(
    parseCampaignUpdatesFeedParams(campaignUpdatesFeedStateToRawParams(state, page)),
  )

export const buildCampaignUpdatesFeedHref = (
  state: CampaignUpdatesFeedState,
  page: number,
): string =>
  buildListHref(state, buildCampaignUpdatesFeedSearchParams, '/campanha/atualizacoes', page)

export const resolveCampaignUpdatesFeedUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: CampaignUpdatesFeedState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: campaignUpdatesFeedParamNameSet,
    parse: parseCampaignUpdatesFeedParams,
    buildSearchParams: buildCampaignUpdatesFeedSearchParams,
    basePath: '/campanha/atualizacoes',
    totalPages,
  })

export const buildCampaignUpdatesFeedWhere = (state: CampaignUpdatesFeedState): Where => {
  const filters: Where[] = []

  if (state.q) filters.push({ body: { contains: state.q } })

  if (state.slugs?.length) filters.push({ 'municipality.slug': { in: state.slugs } })

  if (state.polarities?.length) filters.push({ polarity: { in: state.polarities } })
  if (state.urgent) filters.push({ urgent: { equals: true } })
  if (state.authors?.length) filters.push({ author: { in: state.authors } })

  return filters.length ? { and: filters } : {}
}
