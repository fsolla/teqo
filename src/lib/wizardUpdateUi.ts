import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { WIZARD_CHAIN_SKIP_LABEL } from '@/lib/campaignWizardCopy'
import { resolveWizardChainEntry, wizardChainContinueHref } from '@/lib/wizardActionChain'

export const WIZARD_UPDATE_BODY_STEP_TITLE = 'Registrar atualização' as const

export const WIZARD_UPDATE_SAVE_LABEL = 'Salvar' as const

export type WizardUpdateSkipAction = {
  label: string
  href: string
}

export const shouldShowWizardUpdateSkip = (
  entryAction: CampaignWizardActionId | undefined,
): boolean => entryAction != null && entryAction !== 'register-update'

export const resolveWizardUpdateSkip = (
  entryAction: CampaignWizardActionId | undefined,
  municipalitySlug: string,
  returnPath?: string,
): WizardUpdateSkipAction | undefined =>
  shouldShowWizardUpdateSkip(entryAction)
    ? {
        label: WIZARD_CHAIN_SKIP_LABEL,
        href: wizardChainContinueHref(
          resolveWizardChainEntry(entryAction, 'register-update'),
          'register-update',
          municipalitySlug,
          returnPath,
        ),
      }
    : undefined
