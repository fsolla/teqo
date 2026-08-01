import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { WIZARD_CHAIN_SKIP_LABEL } from '@/lib/campaignWizardCopy'
import type { SupportStatus } from '@/lib/schemas/leadership'
import { resolveWizardChainEntry, wizardChainContinueHref } from '@/lib/wizardActionChain'

/** Client-safe tile payload for the B70 leadership wizard grid. */
export type WizardLeadershipTileViewModel = {
  id: number
  name: string
  phone: string | null
  email: string | null
  supportStatus: SupportStatus | null
  exclusive: boolean
  notes: string | null
}

export type WizardLeadershipSkipAction = {
  label: string
  href: string
}

export const showLeadershipWizardSkip = (entryAction?: CampaignWizardActionId): boolean => {
  const effectiveEntry = entryAction ?? 'update-leadership'
  return effectiveEntry !== 'update-leadership'
}

export const resolveWizardLeadershipSkip = (
  entryAction: CampaignWizardActionId | undefined,
  municipalitySlug: string,
  returnPath?: string,
): WizardLeadershipSkipAction | undefined =>
  showLeadershipWizardSkip(entryAction)
    ? {
        label: WIZARD_CHAIN_SKIP_LABEL,
        href: wizardChainContinueHref(
          resolveWizardChainEntry(entryAction, 'update-leadership'),
          'update-leadership',
          municipalitySlug,
          returnPath,
        ),
      }
    : undefined
