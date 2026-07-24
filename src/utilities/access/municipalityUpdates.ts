// ---------------------------------------------------------------------------
// Municipality updates (immutable field reports)
// ---------------------------------------------------------------------------

import type { Access, FieldAccess } from 'payload'

import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'
import { relationshipId } from '@/utilities/relationship'

export const canCreateMunicipalityUpdate: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}

export const canReadMunicipalityUpdate: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    municipality: {
      in: municipalityIDs ?? [],
    },
  }
}

export const canMutateMunicipalityUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetMunicipalityUpdateAuthor: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
