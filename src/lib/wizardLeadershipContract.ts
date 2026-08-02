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
  /** Declared votes for leadership × wizard municipality; 0 when no pledge. */
  declaredVotes: number
}

/** Maps pledge rows to leadership id → declaredVotes (absent leadership → omitted). */
export const declaredVotesByLeadershipFromPledges = (
  pledges: ReadonlyArray<{ leadership: number | { id: number }; declaredVotes?: number | null }>,
): Map<number, number> => {
  const map = new Map<number, number>()
  for (const pledge of pledges) {
    const leadershipId =
      typeof pledge.leadership === 'number' ? pledge.leadership : pledge.leadership.id
    map.set(leadershipId, pledge.declaredVotes ?? 0)
  }
  return map
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
