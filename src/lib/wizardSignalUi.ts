import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'

export const WIZARD_SIGNAL_TYPE_STEP_TITLE = 'Que tipo de sinal?' as const

export const WIZARD_SIGNAL_BODY_STEP_TITLE_PREFIX = 'Detalhar sinal' as const

export const WIZARD_SIGNAL_SKIP_LABEL = 'Pular registro de sinal' as const

export const WIZARD_SIGNAL_SAVE_LABEL = 'Salvar' as const

export const WIZARD_SIGNAL_SAVED_MESSAGE = 'Sinal registrado.' as const

export type WizardSignalSkipAction = {
  label: string
  href: string
}

export const shouldShowWizardSignalSkip = (
  entryAction: CampaignWizardActionId | undefined,
): boolean => entryAction != null && entryAction !== 'register-signal'

export const resolveWizardSignalSkip = (
  entryAction: CampaignWizardActionId | undefined,
): WizardSignalSkipAction | undefined =>
  shouldShowWizardSignalSkip(entryAction)
    ? { label: WIZARD_SIGNAL_SKIP_LABEL, href: CAMPAIGN_HOME }
    : undefined
