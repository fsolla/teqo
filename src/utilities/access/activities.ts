// ---------------------------------------------------------------------------
// Activities
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

const canStaffCreateActivity: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canCreateActivity: Access = canStaffCreateActivity

export const canReadActivity: Access = async ({ req }): Promise<boolean | Where> => {
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
export const canUpdateActivity: Access = canReadActivity

export const canDeleteActivity: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivitySystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivityStatus: FieldAccess = canStaffCreateActivity

export const canCreateActivityAdvisors: FieldAccess = canStaffCreateActivity

export const canManageActivityAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}
