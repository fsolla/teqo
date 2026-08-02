import type { OrganizationKind } from '@/lib/schemas/organization'
import { organizationKinds } from '@/lib/schemas/organization'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type OrganizationListState = {
  page: number
  q?: string
  kind?: OrganizationKind
}

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

const buildOrganizationListSearchParams = (
  state: OrganizationListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.kind) params.set('kind', state.kind)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildOrganizationListHref = (state: OrganizationListState, page: number): string =>
  buildListHref(state, buildOrganizationListSearchParams, '/campanha/organizacoes', page)
