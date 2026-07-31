import type { ResolvedCampaignHomeAction } from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import type { CampaignRole } from '@/lib/campaignRoles'

/**
 * Pathname + role + page context → contextual quick actions.
 * Catalogs per vertical land in B80–B90; the B79 chassis renders whatever
 * this helper returns (empty until those items register providers).
 */
export const resolveQuickActionsForPath = (
  _pathname: string,
  _role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly ResolvedCampaignHomeAction[] => []
