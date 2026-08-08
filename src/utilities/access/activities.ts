// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, Where } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorMunicipalityScopeWhere,
  getFreshCampaignUser,
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

export const canCampaignUserRescheduleActivity = (
  user: CampaignUser,
  deputyPresent: boolean,
): boolean => isCampaignStaff(user) && (!deputyPresent || isCampaignUnrestricted(user))

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
        // C90 — polymorphic `responsible`: the only scalar query the adapter
        // supports on a multi-relation relationship is the object notation
        // with `equals` (see @payloadcms/drizzle sanitizeQueryValue).
        {
          responsible: {
            equals: { relationTo: 'campaignUser', value: currentUser.id },
          },
        },
        advisorMunicipalityScopeWhere('municipality', municipalityIDs),
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

/** C90 — the unified `responsible` field is editable by any staff with row access. */
export const canSetActivityResponsible: FieldAccess = canStaffCreateActivity
