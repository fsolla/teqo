// ---------------------------------------------------------------------------
// Supporters
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

export const canCreateSupporter: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  if (currentUser?.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  if (isCampaignLeader(currentUser)) {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  return false
}

export const canReadSupporter: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return {
      municipality: {
        in: municipalityIDs ?? [],
      },
    }
  }

  if (isCampaignLeader(currentUser)) {
    return {
      createdBy: {
        equals: currentUser.id,
      },
    }
  }

  return false
}

export const canManageSupporter: Access = canReadSupporter

export const canDeleteSupporter: Access = ({ req }) => isPayloadAdmin(req.user)
