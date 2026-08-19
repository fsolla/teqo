// ---------------------------------------------------------------------------
// Supporters
// ---------------------------------------------------------------------------

import type { Access, Where } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorEditingAccess,
  advisorMunicipalityScopeWhere,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateSupporter: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  // Advisor and leader create through the same scope check: the municipality
  // must be one `getAccessibleMunicipalityIds` resolves for THEIR role
  // (administered for the advisor, engaged-leadership-linked for the leader).
  if (currentUser?.role === 'advisor' || isCampaignLeader(currentUser)) {
    // C141 — supporters are PII: `somente_leitura` closes the write path, but
    // Edição "Tudo" never widens beyond the carteira (gate decision).
    if (currentUser?.role === 'advisor' && advisorEditingAccess(currentUser) === 'none') {
      return false
    }
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
    return advisorMunicipalityScopeWhere(
      'municipality',
      await getAccessibleMunicipalityIds(req, currentUser),
    )
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

/**
 * C141 — supporter row updates follow the Edição axis on the PII cap: an
 * advisor may only touch supporters in the carteira (never beyond it), and
 * `somente_leitura` closes updates entirely.
 */
export const canManageSupporter: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    if (advisorEditingAccess(currentUser) === 'none') return false
    return advisorMunicipalityScopeWhere(
      'municipality',
      await getAccessibleMunicipalityIds(req, currentUser),
    )
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

export const canDeleteSupporter: Access = ({ req }) => isPayloadAdmin(req.user)
