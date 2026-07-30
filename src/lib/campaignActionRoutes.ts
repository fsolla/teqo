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

export const isCampaignWizardActionSlug = (slug: string): boolean => wizardActionSlugs.has(slug)

export const isCampaignWizardActionId = (id: string): id is CampaignWizardActionId =>
  id in CAMPAIGN_WIZARD_ACTION_SLUGS

export const campaignActionEntryHref = (id: CampaignWizardActionId): string =>
  `${CAMPAIGN_ACTIONS_HOME}/${CAMPAIGN_WIZARD_ACTION_SLUGS[id]}`
