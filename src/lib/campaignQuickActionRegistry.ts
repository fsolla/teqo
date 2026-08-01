<<<<<<< HEAD
import {
  resolveStaffHomeQuickActions,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import { CAMPAIGN_TERRITORIES_HOME } from '@/lib/campaignPaths'
=======
import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
>>>>>>> ccc5faf (B84 — Ações rápidas na vertical Atividades (lista + detalhe))
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { parseActivityQuickActionSurface } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import type { CampaignRole } from '@/lib/campaignRoles'

const isTerritoriesListPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_TERRITORIES_HOME || pathname.startsWith(`${CAMPAIGN_TERRITORIES_HOME}/`)

/**
 * Pathname + role + page context → contextual quick actions.
 * Catalogs per vertical land in B80–B90; the B79 chassis renders whatever
 * this helper returns.
 */
export const resolveQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
<<<<<<< HEAD
  _context: CampaignQuickActionContext,
): readonly ResolvedCampaignHomeAction[] => {
  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }
=======
  context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  const activitySurface = parseActivityQuickActionSurface(pathname)
  if (activitySurface) {
    return resolveActivityQuickActions(activitySurface, role, context)
  }

>>>>>>> ccc5faf (B84 — Ações rápidas na vertical Atividades (lista + detalhe))
  return []
}
