import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import type { SupportStatus } from '@/lib/schemas/leadership'

/** Client-safe tile payload for the B70 leadership wizard grid. */
export type WizardLeadershipTileViewModel = {
  id: number
  contactID: number
  name: string
  phone: string | null
  email: string | null
  supportStatus: SupportStatus | null
  exclusive: boolean
  notes: string | null
}

export const showLeadershipWizardSkip = (entryAction?: CampaignWizardActionId): boolean => {
  const effectiveEntry = entryAction ?? 'update-leadership'
  return effectiveEntry !== 'update-leadership'
}
