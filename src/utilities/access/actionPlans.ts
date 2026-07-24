// ---------------------------------------------------------------------------
// Action plans
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, Where } from 'payload'

import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignCoordinator,
  isCampaignLeader,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

const canStaffCreateActionPlan: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canCreateActionPlan: Access = canStaffCreateActionPlan

export const canReadActionPlan: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return {
      or: [
        {
          advisors: {
            contains: currentUser.id,
          },
        },
        {
          municipality: {
            in: municipalityIDs ?? [],
          },
        },
      ],
    }
  }

  return false
}

/** Same row scope as read — leader write limits are enforced in `beforeChange`. */
export const canUpdateActionPlan: Access = canReadActionPlan

export const canDeleteActionPlan: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetActionPlanSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canSetActionPlanStatus: FieldAccess = canStaffCreateActionPlan

export const canCreateActionPlanAdvisors: FieldAccess = canStaffCreateActionPlan

export const canManageActionPlanAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}
