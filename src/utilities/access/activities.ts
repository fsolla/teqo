// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  advisorEditingAccess,
  advisorMunicipalityScopeWhere,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

const canStaffCreateActivity: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

/**
 * C141 — `canCreateActivity` is a plain staff boolean (Payload cannot express
 * a per-município constraint on create), so the Edição axis narrows it for
 * advisors: a `somente_leitura` advisor creates nothing. The giro batch checks
 * the stops against the WRITE scope on top (`getWritableMunicipalityIds`).
 * C165 — an activity without município is coordination/candidate-only (the
 * `supporter` precedent), so an advisor's create requires one; the carteira
 * membership of that município is still enforced by the action.
 */
export const canCreateActivity: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser.role !== 'advisor') return false
  if (advisorEditingAccess(currentUser) === 'none') return false

  return relationshipId(data?.municipality) !== null
}

export const canCampaignUserRescheduleActivity = (
  user: CampaignUser,
  deputyPresent: boolean,
): boolean => isCampaignStaff(user) && (!deputyPresent || isCampaignUnrestricted(user))

const advisorActivityScopeWhere = async (
  req: PayloadRequest,
  currentUser: CampaignUser,
): Promise<Where> => {
  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    // C165 — the `and` closes the responsible branch for an activity WITHOUT
    // município: it is coordination/candidate-only (precedente `supporter`),
    // so an advisor listed as responsible must not see/update it.
    and: [
      { municipality: { exists: true } },
      {
        or: [
          // C90 — polymorphic `responsible`: the only scalar query the adapter
          // supports on a multi-relation relationship is the object notation
          // with `equals` (see @payloadcms/drizzle sanitizeQueryValue).
          {
            responsible: {
              equals: { relationTo: 'campaignUser', value: currentUser.id },
            },
          },
          advisorMunicipalityScopeWhere('municipality', municipalityIDs),
        ],
      },
    ],
  }
}

export const canReadActivity: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    // C141 — Visão "Tudo": the advisor sees the whole activity agenda, except
    // C165 activities without município (coordination/candidate-only).
    if (currentUser.visibility === 'tudo') return { municipality: { exists: true } }
    return advisorActivityScopeWhere(req, currentUser)
  }

  return false
}

/**
 * C141 — the Edição axis rules activity updates. `tudo` widens to every
 * activity; `somente_leitura` closes updates entirely; the carteira branch
 * keeps the same row scope as read (responsible OR municipality).
 * C165 — `tudo` never widens into activities without município.
 * C165-F1 — the Edição axis owns the município VALUE too, not just the row:
 * a write that bypasses the action (REST/Local API with a campaign JWT) must
 * not clear the município (coordination/candidate-only) nor point it at one
 * outside the advisor's write scope. An absent key keeps the row scope below,
 * so editing any other field is unchanged.
 */
export const canUpdateActivity: Access = async ({ data, req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser.role !== 'advisor') return false

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false

  if (data?.municipality !== undefined) {
    const municipalityID = relationshipId(data.municipality)
    // `null` (clear) or a malformed value: coordination/candidate-only.
    if (municipalityID === null) return false
    // Only the carteira needs the membership check (`tudo` skips it above).
    // For `editing === 'carteira'` the read carteira IS the write boundary
    // (the `visibility` axis never widens it), and this helper is memoized —
    // the row scope below reuses the same ids, so no extra query.
    if (editingAccess === 'carteira') {
      const accessibleIDs = await getAccessibleMunicipalityIds(req, currentUser)
      if (accessibleIDs !== null && !accessibleIDs.includes(municipalityID)) return false
    }
  }

  if (editingAccess === 'tudo') return { municipality: { exists: true } }

  return advisorActivityScopeWhere(req, currentUser)
}

export const canDeleteActivity: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivitySystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivityStatus: FieldAccess = canStaffCreateActivity

/** C90 — the unified `responsible` field is editable by any staff with row access. */
export const canSetActivityResponsible: FieldAccess = canStaffCreateActivity
