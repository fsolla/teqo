// ---------------------------------------------------------------------------
// Campaign demands
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

export const canCreateCampaignDemand: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  if (currentUser.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}

export const canReadCampaignDemand: Access = async ({ req }): Promise<boolean | Where> => {
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

/**
 * Staff manage demands in their municipalities; leaders have no demand access.
 */
export const canUpdateCampaignDemand: Access = canReadCampaignDemand

export const canDeleteCampaignDemand: Access = ({ req }) => isPayloadAdmin(req.user)
