// ---------------------------------------------------------------------------
// Campaign invites
// ---------------------------------------------------------------------------

import type { Access, FieldAccess } from 'payload'

import { getAccessibleLeadershipIds } from '@/utilities/access/leaderships'
import {
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'
import { relationshipId } from '@/utilities/relationship'

export const canCreateCampaignInvite: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const leadershipID = relationshipId(data?.leadership)
  if (!leadershipID) return false

  const accessibleLeadershipIDs = await getAccessibleLeadershipIds(req, currentUser)
  return accessibleLeadershipIDs?.includes(leadershipID) ?? false
}

export const canReadCampaignInvite: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const accessibleLeadershipIDs = await getAccessibleLeadershipIds(req, currentUser)

  return {
    leadership: {
      in: accessibleLeadershipIDs ?? [],
    },
  }
}

export const canMutateCampaignInvite: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetCampaignInviteSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
