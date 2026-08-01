import {
  resolveStaffHomeQuickActions,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import type { CampaignRole } from '@/lib/campaignRoles'

const isTerritoriesListPath = (pathname: string): boolean =>
  pathname === '/campanha/territorios' || pathname.startsWith('/campanha/territorios/')

/**
 * Pathname + role + page context → contextual quick actions.
 * Catalogs per vertical land in B80–B90; the B79 chassis renders whatever
 * this helper returns (empty until those items register providers).
 */
export const resolveQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly ResolvedCampaignHomeAction[] => {
  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }
  return []
}
