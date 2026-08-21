// ---------------------------------------------------------------------------
// Campaign demands
// ---------------------------------------------------------------------------

import type { Access, Where } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorEditingAccess,
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
  // C141 — `somente_leitura` creates nothing. Edição "Tudo" does NOT widen
  // demands: they follow the responsibility rule (C143 owns it).
  if (advisorEditingAccess(currentUser) === 'none') return false

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
 * C141 — demands stay out of the profile axes (C143 replaces this rule with
 * explicit responsibles): Edição "Tudo" does not widen the row scope, and
 * `somente_leitura` closes updates entirely.
 */
export const canUpdateCampaignDemand: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (advisorEditingAccess(currentUser) === 'none') return false

  return canReadCampaignDemand({ req })
}

export const canDeleteCampaignDemand: Access = ({ req }) => isPayloadAdmin(req.user)
