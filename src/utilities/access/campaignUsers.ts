// ---------------------------------------------------------------------------
// Campaign users
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import type { DynamicFind } from '@/utilities/access/shared'
import {
  getFreshCampaignUser,
  isCampaignCoordinator,
  isCampaignLeader,
  isCampaignStaff,
  isCampaignUnrestricted,
  isCampaignUser,
  isPayloadAdmin,
} from '@/utilities/access/shared'

const CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY = 'campaignUserPhoneAccess'

export const canManageCampaignUsers: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

export const canManageCampaignUserRole: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

export const canReadCampaignUsers: Access = ({ req }) =>
  isPayloadAdmin(req.user) || isCampaignUser(req.user)

export const canReadCampaignUserIdentity: FieldAccess = ({ req, id }) => {
  if (isPayloadAdmin(req.user)) return true
  if (!isCampaignUser(req.user)) return false

  return id !== undefined && String(id) === String(req.user.id)
}

const canSelfOrStaffUpdateCampaignUser = async (
  req: PayloadRequest,
  id: string | number | undefined,
): Promise<boolean> => {
  if (isPayloadAdmin(req.user)) return true
  if (isCampaignCoordinator(await getFreshCampaignUser(req))) return true
  if (!isCampaignUser(req.user) || id === undefined) return false

  return String(id) === String(req.user.id)
}

export const canUpdateCampaignUser: Access = async ({ req, id }) =>
  canSelfOrStaffUpdateCampaignUser(req, id)

export const canUpdateCampaignUserAvatar: FieldAccess = async ({ req, id }) =>
  canSelfOrStaffUpdateCampaignUser(req, id)

// ---------------------------------------------------------------------------
// Staff-only field access (internal evaluations, estimates, financials)
// ---------------------------------------------------------------------------

export const canReadCampaignStaffField: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canManageCampaignStaffField: FieldAccess = canReadCampaignStaffField

/** System/derived fields are written only via server actions with overrideAccess. */
export const canSetCampaignSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Campaign user phone visibility
// ---------------------------------------------------------------------------

export const canReadCampaignUserPhone: FieldAccess = async ({ doc, id, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (id !== undefined && String(id) === String(currentUser.id)) return true
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (id === undefined) return false

  const targetUserID = Number(id)
  if (!Number.isInteger(targetUserID) || targetUserID <= 0) return false

  const context = req.context as Record<string, unknown>
  const cacheKey = `${CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY}:${currentUser.id}:${targetUserID}`
  if (typeof context[cacheKey] === 'boolean') return context[cacheKey]

  let targetRole = typeof doc === 'object' && doc !== null && 'role' in doc ? doc.role : undefined
  if (targetRole === undefined) {
    try {
      const target = await req.payload.findByID({
        collection: 'campaignUser',
        id: targetUserID,
        depth: 0,
        select: { role: true },
        overrideAccess: true,
        req,
      })
      targetRole = target.role
    } catch {
      // Missing target only — fall through to the municipality-scope check.
    }
  }
  if (targetRole === 'coordinator') {
    context[cacheKey] = true
    return true
  }

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  if (!municipalityIDs?.length) {
    context[cacheKey] = false
    return false
  }

  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  const result = await find({
    collection: 'municipality',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { id: true },
    where: {
      and: [{ id: { in: municipalityIDs } }, { advisors: { contains: targetUserID } }],
    },
  })
  const allowed = result.docs.length > 0
  context[cacheKey] = allowed
  return allowed
}

export const canCreateCampaignUserPhone: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignCoordinator(await getFreshCampaignUser(req))
}

export const canUpdateCampaignUserPhone: FieldAccess = async ({ id, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (id !== undefined && String(id) === String(currentUser.id)) return true
  return isCampaignCoordinator(currentUser)
}
