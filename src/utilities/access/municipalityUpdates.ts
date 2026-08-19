// ---------------------------------------------------------------------------
// Municipality updates (immutable field reports)
// ---------------------------------------------------------------------------

import type { Access, FieldAccess } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorEditingAccess,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveProfileScopedRead,
} from '@/utilities/access/shared'

export const canCreateMunicipalityUpdate: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false
  if (editingAccess === 'tudo') return true

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}

export const canReadMunicipalityUpdate: Access = ({ req }) =>
  resolveProfileScopedRead(req, 'municipality', getAccessibleMunicipalityIds)

export const canMutateMunicipalityUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetMunicipalityUpdateAuthor: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
