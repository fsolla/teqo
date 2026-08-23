// ---------------------------------------------------------------------------
// Allocation decisions (E14 movements, triage outcomes)
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
  payloadAdminOnly,
} from '@/utilities/access/shared'

export { canReadMunicipalityUpdate as canReadAllocationDecision } from '@/utilities/access/municipalityUpdates'

/**
 * Allocation decisions are coordination records (E14 movements, triage
 * outcomes): raw updates stay admin-only. Deliberate no longer aliases the
 * municipality-update update gate — that gate is C88's deliberative
 * `mutationKind` channel, which must never reach this collection.
 */
export const canMutateAllocationDecision: Access = payloadAdminOnly

/**
 * C141 — allocation decisions record coordination movements (E14) and triage
 * outcomes: Edição "Tudo" does NOT widen the create scope, unlike the generic
 * municipality-update create the old alias inherited. The carteira stays the
 * ceiling for advisors on BOTH profile axes; `somente_leitura` closes the
 * write path entirely. The E14 action itself stays unrestricted-gated.
 */
export const canCreateAllocationDecision: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}
