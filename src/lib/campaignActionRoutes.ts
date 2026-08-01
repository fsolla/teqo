/** Client-safe entry paths for UX-1 action wizards under `/campanha/acoes`. */

import {
  parsePoliticalTrendStatusFormValue,
  type PoliticalTrendStatusValue,
} from '@/lib/schemas/municipality'
import {
  parseMunicipalitySignalType,
  type MunicipalitySignalType,
} from '@/lib/schemas/municipalityUpdate'

export const CAMPAIGN_ACTIONS_HOME = '/campanha/acoes' as const

export type CampaignWizardActionId =
  | 'update-votes'
  | 'register-signal'
  | 'change-trend'
  | 'update-leadership'
  | 'register-demand'

export const CAMPAIGN_WIZARD_ACTION_SLUGS: Record<CampaignWizardActionId, string> = {
  'update-votes': 'atualizar-votos',
  'register-signal': 'registrar-sinal',
  'change-trend': 'mudar-tendencia',
  'update-leadership': 'atualizar-lideranca',
  'register-demand': 'registrar-pedido',
}

const wizardActionSlugs = new Set(Object.values(CAMPAIGN_WIZARD_ACTION_SLUGS))

const campaignWizardSlugToId = Object.fromEntries(
  Object.entries(CAMPAIGN_WIZARD_ACTION_SLUGS).map(([id, actionSlug]) => [
    actionSlug,
    id as CampaignWizardActionId,
  ]),
) as Record<string, CampaignWizardActionId>

export const isCampaignWizardActionSlug = (slug: string): boolean => wizardActionSlugs.has(slug)

export const campaignWizardActionIdForSlug = (slug: string): CampaignWizardActionId | undefined =>
  campaignWizardSlugToId[slug]

export const isCampaignWizardActionId = (id: string): id is CampaignWizardActionId =>
  id in CAMPAIGN_WIZARD_ACTION_SLUGS

export const campaignActionEntryHref = (id: CampaignWizardActionId): string =>
  `${CAMPAIGN_ACTIONS_HOME}/${CAMPAIGN_WIZARD_ACTION_SLUGS[id]}`

export const WIZARD_MUNICIPIO_QUERY_KEY = 'municipio' as const

/** Legacy B61 ritual param — canonical URLs omit it (B77). */
export const WIZARD_SCENARIO_QUERY_KEY = 'cenario' as const

export const WIZARD_SIGNAL_TYPE_QUERY_KEY = 'signalType' as const

export const WIZARD_ENTRY_ACTION_QUERY_KEY = 'entry' as const

export const WIZARD_TREND_STATUS_QUERY_KEY = 'trendStatus' as const

export const WIZARD_NOTE_PREFILL_QUERY_KEY = 'notePrefill' as const

export const WIZARD_SIGNAL_BODY_QUERY_KEY = 'signalBody' as const

export const WIZARD_VOTE_FROM_QUERY_KEY = 'voteFrom' as const

export const WIZARD_VOTE_TO_QUERY_KEY = 'voteTo' as const

export const WIZARD_LEADERSHIP_ID_QUERY_KEY = 'leadershipId' as const

export const WIZARD_RETURN_PATH_QUERY_KEY = 'from' as const

const WIZARD_RETURN_PATH_AUTH_PREFIXES = [
  '/campanha/login',
  '/campanha/convite',
  '/campanha/redefinir-senha',
  '/campanha/webauthn',
] as const

/** Allowlisted internal return paths for wizard dismiss / chain end (B110). */
export const isWizardReturnPath = (pathname: string): boolean => {
  if (!pathname.startsWith('/campanha')) return false
  if (pathname.startsWith('/campanha/acoes')) return false
  for (const prefix of WIZARD_RETURN_PATH_AUTH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return false
  }
  return true
}

export const parseWizardReturnPath = (
  value: string | string[] | undefined,
): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  if (trimmed.includes('://') || trimmed.startsWith('//')) return undefined
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (path.includes('?') || path.includes('#')) return undefined
  return isWizardReturnPath(path) ? path : undefined
}

export const appendWizardReturnPath = (href: string, returnPath?: string): string => {
  if (!returnPath || !isWizardReturnPath(returnPath)) return href
  const queryIndex = href.indexOf('?')
  const base = queryIndex === -1 ? href : href.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex === -1 ? '' : href.slice(queryIndex + 1))
  params.set(WIZARD_RETURN_PATH_QUERY_KEY, returnPath)
  return `${base}?${params.toString()}`
}

export type WizardActionHrefOptions = {
  entryAction?: CampaignWizardActionId
  leadershipId?: number
  returnPath?: string
}

export const wizardActionHref = (
  actionSlug: string,
  municipalitySlug?: string,
  options?: WizardActionHrefOptions,
): string => {
  const base = `${CAMPAIGN_ACTIONS_HOME}/${actionSlug}`
  if (!municipalitySlug && !options?.leadershipId && !options?.entryAction) {
    return appendWizardReturnPath(base, options?.returnPath)
  }
  const params = new URLSearchParams()
  if (municipalitySlug) {
    params.set(WIZARD_MUNICIPIO_QUERY_KEY, municipalitySlug)
  }
  if (options?.entryAction) {
    params.set(WIZARD_ENTRY_ACTION_QUERY_KEY, options.entryAction)
  }
  if (options?.leadershipId !== undefined) {
    params.set(WIZARD_LEADERSHIP_ID_QUERY_KEY, String(options.leadershipId))
  }
  const href = params.size > 0 ? `${base}?${params.toString()}` : base
  return appendWizardReturnPath(href, options?.returnPath)
}

export const parseWizardMunicipioParam = (
  value: string | string[] | undefined,
): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export const parseWizardLeadershipIdParam = (
  value: string | string[] | undefined,
): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed || !/^[1-9]\d*$/.test(trimmed)) {
    return undefined
  }
  return Number(trimmed)
}

export const hasWizardScenarioParam = (value: string | string[] | undefined): boolean =>
  parseWizardMunicipioParam(value) !== undefined

export const parseWizardEntryActionParam = (
  value: string | string[] | undefined,
): CampaignWizardActionId | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed || !isCampaignWizardActionId(trimmed)) {
    return undefined
  }
  return trimmed
}

export const wizardSignalHref = (
  actionSlug: string,
  municipalitySlug?: string,
  signalType?: MunicipalitySignalType,
  entryAction?: CampaignWizardActionId,
  returnPath?: string,
): string => {
  const base = `${CAMPAIGN_ACTIONS_HOME}/${actionSlug}`
  if (!municipalitySlug) {
    return appendWizardReturnPath(base, returnPath)
  }

  const params = new URLSearchParams({ [WIZARD_MUNICIPIO_QUERY_KEY]: municipalitySlug })
  if (signalType) {
    params.set(WIZARD_SIGNAL_TYPE_QUERY_KEY, signalType)
  }
  if (entryAction) {
    params.set(WIZARD_ENTRY_ACTION_QUERY_KEY, entryAction)
  }
  return appendWizardReturnPath(`${base}?${params.toString()}`, returnPath)
}

export const resolveWizardSignalTypeParam = (
  value: string | string[] | undefined,
): { signalType?: MunicipalitySignalType; invalid: boolean } => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { signalType: undefined, invalid: false }
  }

  const signalType = parseMunicipalitySignalType(trimmed)
  if (signalType) {
    return { signalType, invalid: false }
  }

  return { signalType: undefined, invalid: true }
}

export const wizardTrendHref = (
  actionSlug: string,
  municipalitySlug?: string,
  trendStatus?: PoliticalTrendStatusValue,
  entryAction?: CampaignWizardActionId,
  extraParams?: Record<string, string>,
  returnPath?: string,
): string => {
  const base = `${CAMPAIGN_ACTIONS_HOME}/${actionSlug}`
  if (!municipalitySlug) {
    return appendWizardReturnPath(base, returnPath)
  }

  const params = new URLSearchParams({ [WIZARD_MUNICIPIO_QUERY_KEY]: municipalitySlug })
  if (trendStatus) {
    params.set(WIZARD_TREND_STATUS_QUERY_KEY, trendStatus)
  }
  if (entryAction) {
    params.set(WIZARD_ENTRY_ACTION_QUERY_KEY, entryAction)
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value)
    }
  }
  return appendWizardReturnPath(`${base}?${params.toString()}`, returnPath)
}

export const resolveWizardTrendStatusParam = (
  value: string | string[] | undefined,
): { trendStatus?: PoliticalTrendStatusValue; invalid: boolean } => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { trendStatus: undefined, invalid: false }
  }

  const trendStatus = parsePoliticalTrendStatusFormValue(trimmed)
  if (trendStatus) {
    return { trendStatus, invalid: false }
  }

  return { trendStatus: undefined, invalid: true }
}
