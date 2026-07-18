import type { Where } from 'payload'

import {
  isSupporterVoteIntention,
  resolveBahiaMunicipality,
  type SupporterVoteIntention,
} from '@/lib/schemas/supporter'
import type { CampaignUser, Supporter } from '@/payload-types'
import { normalizeBrazilianPhone } from '@/utilities/phone'

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
  convite: 'Convite',
  evento: 'Evento',
}

export type SupporterListState = {
  page: number
  q?: string
  voteIntention?: SupporterVoteIntention
  city?: string
  nucleus?: number
}

type RawSearchParams = Record<string, string | string[] | undefined>

export const supporterListParamNames = ['q', 'voteIntention', 'city', 'nucleus', 'page'] as const

const supporterListParamNameSet = new Set<string>(supporterListParamNames)

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const normalizedText = (value: FormDataEntryValue | string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

const strictDecimalInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

export const parseSupporterListParams = (params: RawSearchParams): SupporterListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const city = resolveBahiaMunicipality(firstValue(params.city)) ?? undefined
  const rawVoteIntention = firstValue(params.voteIntention)
  const voteIntention = isSupporterVoteIntention(rawVoteIntention) ? rawVoteIntention : undefined
  const nucleus = strictDecimalInteger(firstValue(params.nucleus))

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(voteIntention ? { voteIntention } : {}),
    ...(city ? { city } : {}),
    ...(nucleus ? { nucleus } : {}),
  }
}

export const buildSupporterListWhere = (state: SupporterListState): Where => {
  const filters: Where[] = []

  if (state.q) {
    const searchFilters: Where[] = [
      { 'contact.name': { contains: state.q } },
      { 'contact.city': { contains: state.q } },
    ]
    const normalizedPhone = normalizeBrazilianPhone(state.q)
    if (normalizedPhone) {
      searchFilters.push({ 'contact.phone': { equals: normalizedPhone } })
    } else if (/\d/.test(state.q)) {
      searchFilters.push({ 'contact.phone': { contains: state.q.replace(/\D/g, '') } })
    }
    filters.push({ or: searchFilters })
  }

  if (state.voteIntention) {
    filters.push({ voteIntention: { equals: state.voteIntention } })
  }
  if (state.city) {
    filters.push({ 'contact.city': { equals: state.city } })
  }
  if (state.nucleus) {
    filters.push({ nucleus: { equals: state.nucleus } })
  }

  return filters.length ? { and: filters } : {}
}

export const buildSupporterListSearchParams = (
  state: SupporterListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseSupporterListParams({
    page: String(page),
    q: state.q,
    voteIntention: state.voteIntention,
    city: state.city,
    nucleus: state.nucleus === undefined ? undefined : String(state.nucleus),
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.voteIntention) params.set('voteIntention', canonicalState.voteIntention)
  if (canonicalState.city) params.set('city', canonicalState.city)
  if (canonicalState.nucleus) params.set('nucleus', String(canonicalState.nucleus))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildSupporterFiltersKey = (state: SupporterListState): string =>
  buildSupporterListSearchParams(state).toString()

export const buildSupporterListHref = (state: SupporterListState, page: number): string => {
  const params = buildSupporterListSearchParams(state, page)
  const query = params.toString()
  return query ? `/campanha/apoiadores?${query}` : '/campanha/apoiadores'
}

const inspectRawSupporterListParams = (
  params: RawSearchParams,
): { hasUnsupportedParams: boolean; query: string } => {
  const serialized = new URLSearchParams()
  let hasUnsupportedParams = false

  for (const [name, value] of Object.entries(params)) {
    if (!supporterListParamNameSet.has(name)) {
      hasUnsupportedParams = true
      continue
    }
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      serialized.append(name, item)
    }
  }

  return { hasUnsupportedParams, query: serialized.toString() }
}

export const resolveSupporterListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: SupporterListState
  href: string
  redirectHref?: string
} => {
  const parsedState = parseSupporterListParams(params)
  const page =
    totalPages !== undefined && totalPages > 0 && parsedState.page > totalPages
      ? totalPages
      : parsedState.page
  const state = page === parsedState.page ? parsedState : { ...parsedState, page }
  const canonicalParams = buildSupporterListSearchParams(state)
  const canonicalQuery = canonicalParams.toString()
  const href = canonicalQuery ? `/campanha/apoiadores?${canonicalQuery}` : '/campanha/apoiadores'
  const raw = inspectRawSupporterListParams(params)
  const needsRedirect = raw.hasUnsupportedParams || raw.query !== canonicalQuery

  return {
    state,
    href,
    ...(needsRedirect ? { redirectHref: href } : {}),
  }
}

export const getSupporterScopeLabel = (total: number): string =>
  `${total} ${total === 1 ? 'apoiador nos seus núcleos' : 'apoiadores nos seus núcleos'}`

export const canAccessSupporterArea = (role: CampaignUser['role']): boolean =>
  role === 'geral' || role === 'coordenador'
