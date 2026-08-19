// ---------------------------------------------------------------------------
// Campaign demands
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorEditingAccess,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveActorScopedRead,
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

export const canReadCampaignDemand: Access = ({ req }) =>
  resolveActorScopedRead(req, 'municipality', getAccessibleMunicipalityIds)

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

  return resolveActorScopedRead(req, 'municipality', getAccessibleMunicipalityIds)
}

export const canDeleteCampaignDemand: Access = ({ req }) => isPayloadAdmin(req.user)
