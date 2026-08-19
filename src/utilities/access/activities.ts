// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

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
 */
export const canCreateActivity: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  if (currentUser.role === 'advisor') return advisorEditingAccess(currentUser) !== 'none'

  return true
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
  }
}

export const canReadActivity: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    // C141 — Visão "Tudo": the advisor sees the whole activity agenda.
    if (currentUser.visibility === 'tudo') return true
    return advisorActivityScopeWhere(req, currentUser)
  }

  return false
}

/**
 * C141 — the Edição axis rules activity updates. `tudo` widens to every
 * activity; `somente_leitura` closes updates entirely; the carteira branch
 * keeps the same row scope as read (responsible OR municipality).
 */
export const canUpdateActivity: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser.role !== 'advisor') return false

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false
  if (editingAccess === 'tudo') return true

  return advisorActivityScopeWhere(req, currentUser)
}

export const canDeleteActivity: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivitySystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canSetActivityStatus: FieldAccess = canStaffCreateActivity

/** C90 — the unified `responsible` field is editable by any staff with row access. */
export const canSetActivityResponsible: FieldAccess = canStaffCreateActivity
