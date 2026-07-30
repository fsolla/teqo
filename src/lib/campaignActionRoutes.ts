/** Client-safe entry paths for UX-1 action wizards under `/campanha/acoes`. */

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

export const wizardActionHref = (actionSlug: string, municipalitySlug?: string): string => {
  const base = `${CAMPAIGN_ACTIONS_HOME}/${actionSlug}`
  if (!municipalitySlug) {
    return base
  }
  const params = new URLSearchParams({ [WIZARD_MUNICIPIO_QUERY_KEY]: municipalitySlug })
  return `${base}?${params.toString()}`
}

export const parseWizardMunicipioParam = (
  value: string | string[] | undefined,
): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export const hasWizardScenarioParam = (value: string | string[] | undefined): boolean => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() ? true : false
}
