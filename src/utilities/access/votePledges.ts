// ---------------------------------------------------------------------------
// Vote pledges (declared by staff, estimated by staff)
// ---------------------------------------------------------------------------

import type { Access, Where } from 'payload'

import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'
import { relationshipId } from '@/utilities/relationship'

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

export const canReadVotePledge: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    municipality: {
      in: municipalityIDs ?? [],
    },
  }
}

/** Same row scope as read — the estimated fields are gated by field access. */
export const canUpdateVotePledge: Access = canReadVotePledge

export const canDeleteVotePledge: Access = ({ req }) => isPayloadAdmin(req.user)
