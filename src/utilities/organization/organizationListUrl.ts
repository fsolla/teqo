import type { OrganizationKind } from '@/lib/schemas/organization'
import { organizationKinds } from '@/lib/schemas/organization'
import {
  buildListHref,
  firstValue,
  normalizedText,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

/**
 * B161 — continuous list: `page` left the URL contract (see demandListUrl).
 */
export type OrganizationListState = {
  q?: string
  kind?: OrganizationKind
}

export const parseOrganizationListParams = (
  searchParams: RawSearchParams,
): OrganizationListState => {
  const q = normalizedText(firstValue(searchParams.q))
  const rawKind = firstValue(searchParams.kind)

  return {
    ...(q ? { q } : {}),
    ...(organizationKinds.includes(rawKind as OrganizationKind)
      ? { kind: rawKind as OrganizationKind }
      : {}),
  }
}

const buildOrganizationListSearchParams = (state: OrganizationListState): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.kind) params.set('kind', state.kind)
  return params
}

export const buildOrganizationListHref = (state: OrganizationListState): string =>
  buildListHref(state, buildOrganizationListSearchParams, '/campanha/organizacoes')
