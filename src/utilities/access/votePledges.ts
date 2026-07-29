// ---------------------------------------------------------------------------
// Vote pledges (declared by staff, estimated by staff)
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveActorScopedRead,
} from '@/utilities/access/shared'

export const canCreateVotePledge: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false

  const municipalityID = relationshipId(data?.municipality)
  const leadershipID = relationshipId(data?.leadership)
  if (!municipalityID || !leadershipID) return false

  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  return false
}

export const canReadVotePledge: Access = ({ req }) =>
  resolveActorScopedRead(req, 'municipality', getAccessibleMunicipalityIds)

/** Same row scope as read — the estimated fields are gated by field access. */
export const canUpdateVotePledge: Access = canReadVotePledge

export const canDeleteVotePledge: Access = ({ req }) => isPayloadAdmin(req.user)
