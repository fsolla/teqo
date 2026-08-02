/**
 * Organization list URL contract — client-safe (OH12). Loaders stay in
 * `organizationData.ts` (`server-only`).
 */
import type { OrganizationKind } from '@/lib/schemas/organization'
import { organizationKinds } from '@/lib/schemas/organization'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const organizationPageSize = 25

export type OrganizationListState = {
  page: number
  q?: string
  kind?: OrganizationKind
}

export type OrganizationListSearchParams = RawSearchParams

const organizationListParamNames = ['q', 'kind', 'page'] as const
const organizationListParamNameSet = new Set<string>(organizationListParamNames)

export const parseOrganizationListParams = (
  searchParams: RawSearchParams,
): OrganizationListState => {
  const q = normalizedText(firstValue(searchParams.q))
  const rawKind = firstValue(searchParams.kind)

  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(q ? { q } : {}),
    ...(organizationKinds.includes(rawKind as OrganizationKind)
      ? { kind: rawKind as OrganizationKind }
      : {}),
  }
}

const organizationListStateToRawParams = (
  state: OrganizationListState,
  page = state.page,
): OrganizationListSearchParams => ({
  page: String(page),
  q: state.q,
  kind: state.kind,
})

const serializeCanonicalOrganizationListSearchParams = (
  canonicalState: OrganizationListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildOrganizationListSearchParams = (
  state: OrganizationListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalOrganizationListSearchParams(
    parseOrganizationListParams(organizationListStateToRawParams(state, page)),
  )

export const buildOrganizationListHref = (state: OrganizationListState, page: number): string =>
  buildListHref(state, buildOrganizationListSearchParams, '/campanha/organizacoes', page)

export const resolveOrganizationListUrl = (
  params: OrganizationListSearchParams,
  totalPages?: number,
): {
  state: OrganizationListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: organizationListParamNameSet,
    parse: parseOrganizationListParams,
    buildSearchParams: buildOrganizationListSearchParams,
    basePath: '/campanha/organizacoes',
    totalPages,
  })
