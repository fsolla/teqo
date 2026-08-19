// ---------------------------------------------------------------------------
// Vote pledges (declared by staff, estimated by staff)
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
  resolveProfileScopedRead,
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
    const editingAccess = advisorEditingAccess(currentUser)
    if (editingAccess === 'none') return false
    if (editingAccess === 'tudo') return true

    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  return false
}

export const canReadVotePledge: Access = ({ req }) =>
  resolveProfileScopedRead(req, 'municipality', getAccessibleMunicipalityIds)

/**
 * C141 — the Edição axis rules updates. `tudo` widens to every pledge;
 * `somente_leitura` closes updates entirely; the carteira branch keeps the
 * same row scope as read.
 */
export const canUpdateVotePledge: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false
  if (editingAccess === 'tudo') return true

  return resolveActorScopedRead(req, 'municipality', getAccessibleMunicipalityIds)
}

export const canDeleteVotePledge: Access = ({ req }) => isPayloadAdmin(req.user)
