import type { Where } from 'payload'

import {
  isSupporterVoteIntention,
  resolveBahiaMunicipality,
  type SupporterVoteIntention,
} from '@/lib/schemas/supporter'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser, Supporter } from '@/payload-types'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import { toPayloadWhere } from '@/utilities/supporterListFilters'

export const supporterPageSize = 25

export const supporterVoteIntentionLabels: Record<SupporterVoteIntention, string> = {
  certo: 'Certo',
  tende_a_certo: 'Tende a certo',
  indeciso: 'Indeciso',
  outro: 'Outro',
}

export const supporterSourceLabels: Record<Supporter['source'], string> = {
  import_csv: 'Importação CSV',
  manual: 'Cadastro manual',
  lideranca: 'Liderança',
  convite: 'Convite',
  evento: 'Evento',
}

export type SupporterListState = {
  page: number
  q?: string
  voteIntention?: SupporterVoteIntention
  city?: string
  municipality?: number
}

type RawSearchParams = CampaignListRawSearchParams

export const supporterListParamNames = [
  'q',
  'voteIntention',
  'city',
  'municipality',
  'page',
] as const

const supporterListParamNameSet = new Set<string>(supporterListParamNames)

export const parseSupporterListParams = (params: RawSearchParams): SupporterListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const city = resolveBahiaMunicipality(firstValue(params.city)) ?? undefined
  const rawVoteIntention = firstValue(params.voteIntention)
  const voteIntention = isSupporterVoteIntention(rawVoteIntention) ? rawVoteIntention : undefined
  const municipality = strictDecimalInteger(firstValue(params.municipality))

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(voteIntention ? { voteIntention } : {}),
    ...(city ? { city } : {}),
    ...(municipality ? { municipality } : {}),
  }
}

export const buildSupporterListWhere = (state: SupporterListState): Where => toPayloadWhere(state)

export const buildSupporterListSearchParams = (
  state: SupporterListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseSupporterListParams({
    page: String(page),
    q: state.q,
    voteIntention: state.voteIntention,
    city: state.city,
    municipality: state.municipality === undefined ? undefined : String(state.municipality),
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.voteIntention) params.set('voteIntention', canonicalState.voteIntention)
  if (canonicalState.city) params.set('city', canonicalState.city)
  if (canonicalState.municipality) params.set('municipality', String(canonicalState.municipality))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildSupporterFiltersKey = (state: SupporterListState): string =>
  buildSupporterListSearchParams(state).toString()

export const buildSupporterListHref = (state: SupporterListState, page: number): string =>
  buildListHref(state, buildSupporterListSearchParams, '/campanha/apoiadores', page)

export const resolveSupporterListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: SupporterListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: supporterListParamNameSet,
    parse: parseSupporterListParams,
    buildSearchParams: buildSupporterListSearchParams,
    basePath: '/campanha/apoiadores',
    totalPages,
  })

export const getSupporterScopeLabel = (total: number): string =>
  `${total} ${total === 1 ? 'apoiador nos seus municípios' : 'apoiadores nos seus municípios'}`

/** Staff roles with supporter-area access — matches collection-level supporter access. */
export const canAccessSupporterArea = (role: CampaignUser['role']): boolean =>
  isStaffCampaignRole(role)
