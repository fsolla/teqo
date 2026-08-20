// ---------------------------------------------------------------------------
// Campaign demands
// ---------------------------------------------------------------------------

import type { Access, Where } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

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

/**
 * C143 — explicit-responsible visibility, fail-closed. An advisor reads ONLY
 * demands where they are a listed responsible (the creator is auto-added on
 * create); a municipality-related advisor who is not responsible sees nothing
 * — not the list, not the URL, not the search (all reads run the collection
 * access). Candidate and coordinator (unrestricted) always see everything.
 */
export const canReadCampaignDemand: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role !== 'advisor') return false

  return { responsibles: { contains: currentUser.id } }
}

/**
 * Staff manage demands they can see — same row scope as read, which is also
 * who may manage the `responsibles` list (C143).
 */
export const canUpdateCampaignDemand: Access = canReadCampaignDemand

export const canDeleteCampaignDemand: Access = ({ req }) => isPayloadAdmin(req.user)
