import type { CampaignUser, User } from '@/payload-types'
import type { Access, FieldAccess, Payload, PayloadRequest, Where } from 'payload'

import { relationshipId } from '@/utilities/relationship'

type CampaignActor = CampaignUser | User | null | undefined
type PlazaID = number
type AccessiblePlazaIDs = PlazaID[] | null
type ContactID = number
type LeadershipID = number
type AccessibleLeadershipIDs = LeadershipID[] | null

const ACCESSIBLE_PLAZA_IDS_CONTEXT_KEY = 'campaignAccessiblePlazaIds'
const ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY = 'campaignAccessibleContactIds'
const ACCESSIBLE_LEADERSHIP_IDS_CONTEXT_KEY = 'campaignAccessibleLeadershipIds'
const OWN_LEADERSHIP_CONTEXT_KEY = 'campaignOwnLeadership'
const CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY = 'campaignUserPhoneAccess'

/** Enough of a request for Local API calls inside an existing transaction. */
export type CampaignTransactionRequest = PayloadRequest | { transactionID: number | string }

type DynamicFind = (args: {
  collection: string
  depth: number
  limit: number
  overrideAccess: true
  pagination: false
  req?: CampaignTransactionRequest
  select: Record<string, true>
  where: Record<string, unknown>
}) => Promise<{ docs: Array<Record<string, unknown>> }>

export const isPayloadAdmin = (user: CampaignActor): user is User => user?.collection === 'users'

const isCampaignUser = (user: CampaignActor): user is CampaignUser =>
  user?.collection === 'campaignUser'

/** "Coordenador Geral" — unrestricted campaign coordination. */
export const isCampaignCoordinator = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'coordinator'

/** Staff = coordinator or advisor ("Assessor"). Leaders are not staff. */
export const isCampaignStaff = (user: CampaignActor): boolean =>
  isCampaignUser(user) && (user.role === 'coordinator' || user.role === 'advisor')

/** Eligible relationship targets for advisor assignments (plaza / action plan). */
export const eligibleCampaignStaffWhere: Where = {
  or: [{ role: { equals: 'coordinator' } }, { role: { equals: 'advisor' } }],
}

export const getFreshCampaignUser = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<CampaignUser | null> => {
  if (!isCampaignUser(user)) return null

  try {
    return await req.payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Campaign users
// ---------------------------------------------------------------------------

export const canManageCampaignUsers: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}

export const canManageCampaignUserRole: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
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
// Plazas (Praças)
// ---------------------------------------------------------------------------

/**
 * Plaza IDs where `advisorID` is an assigned advisor, without requiring a
 * `PayloadRequest`. Canonical implementation of the "advisors contains
 * user.id" lookup; `getAccessiblePlazaIds` uses it for its (request-scoped,
 * context-cached) advisor branch.
 */
export const getAdvisorPlazaIds = async (
  payload: Pick<Payload, 'find'>,
  advisorID: number,
  req?: CampaignTransactionRequest,
): Promise<number[]> => {
  const find = payload.find.bind(payload) as unknown as DynamicFind
  const result = await find({
    collection: 'plaza',
    where: { advisors: { contains: advisorID } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { id: true },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  return result.docs.map((doc) => relationshipId(doc.id)).filter((id): id is number => id !== null)
}

type OwnLeadership = { id: number; plazaIDs: number[]; organizationIDs: number[] } | null

/**
 * The engaged leadership record linked to the authenticated leader account
 * (contact is unique per person, so there is at most one). Cached per request.
 */
export const getOwnEngagedLeadership = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<OwnLeadership> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user
  if (!isCampaignUser(currentUser)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${OWN_LEADERSHIP_CONTEXT_KEY}:${currentUser.id}`
  if (cacheKey in context) return context[cacheKey] as OwnLeadership

  const collections = req.payload.collections as Record<string, unknown>
  let ownLeadership: OwnLeadership = null

  if (collections.leadership) {
    const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
    const result = await find({
      collection: 'leadership',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      select: { plazas: true, organizations: true },
      where: {
        and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
      },
    })

    const doc = result.docs[0]
    if (doc) {
      const id = relationshipId(doc.id)
      if (id !== null) {
        ownLeadership = {
          id,
          plazaIDs: (Array.isArray(doc.plazas) ? doc.plazas : [])
            .map(relationshipId)
            .filter((value): value is number => value !== null),
          organizationIDs: (Array.isArray(doc.organizations) ? doc.organizations : [])
            .map(relationshipId)
            .filter((value): value is number => value !== null),
        }
      }
    }
  }

  context[cacheKey] = ownLeadership
  return ownLeadership
}

/**
 * Returns null for the unrestricted coordinator, otherwise the plaza IDs the
 * authenticated campaign user can operate on: administered plazas for an
 * advisor, linked (engaged) plazas for a leader.
 */
export const getAccessiblePlazaIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessiblePlazaIDs> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignCoordinator(currentUser)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_PLAZA_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const collections = req.payload.collections as Record<string, unknown>
  let ids: PlazaID[] = []

  if (currentUser.role === 'advisor' && collections.plaza) {
    ids = await getAdvisorPlazaIds(req.payload, currentUser.id, req)
  }

  if (currentUser.role === 'leader') {
    const ownLeadership = await getOwnEngagedLeadership(req, currentUser)
    ids = ownLeadership?.plazaIDs ?? []
  }

  const uniqueIDs = [...new Set(ids)]
  context[cacheKey] = uniqueIDs

  return uniqueIDs
}

/** Plazas are seeded by migration; nobody creates or deletes them in the app. */
export const canCreatePlaza: Access = ({ req }) => isPayloadAdmin(req.user)

export const canReadPlaza: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const ids = await getAccessiblePlazaIds(req)
  if (ids === null) return true

  return {
    id: {
      in: ids,
    },
  }
}

export const canUpdatePlaza: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  return {
    advisors: {
      contains: currentUser.id,
    },
  }
}

export const canDeletePlaza: Access = ({ req }) => isPayloadAdmin(req.user)

/** Advisor assignment is coordinator-only (server actions use overrideAccess). */
export const canAssignPlazaAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}

export const canManagePlazaAdvisors: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const canReadContacts: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  const ids = await getAccessibleContactIds(req, currentUser)

  return {
    id: {
      in: ids,
    },
  }
}

export const canManageContacts: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Leaderships
// ---------------------------------------------------------------------------

export const canSetAdministrativeLeadershipField: FieldAccess = ({ req }) =>
  isPayloadAdmin(req.user)

const plazaIDsFromData = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

export const canReadLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  if (currentUser.role === 'leader') {
    const leadershipScope: Where = {
      and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
    }
    return leadershipScope
  }

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)

  return {
    plazas: {
      in: plazaIDs ?? [],
    },
  }
}

export const canCreateLeadership: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const requestedPlazaIDs = plazaIDsFromData(data?.plazas)
  if (requestedPlazaIDs.length === 0) return false

  const accessiblePlazaIDs = await getAccessiblePlazaIds(req, currentUser)
  if (accessiblePlazaIDs === null) return true

  return requestedPlazaIDs.every((id) => accessiblePlazaIDs.includes(id))
}

export const canManageLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)

  return {
    plazas: {
      in: plazaIDs ?? [],
    },
  }
}

export const canDeleteLeadership: Access = ({ req }) => isPayloadAdmin(req.user)

/**
 * Returns null for the unrestricted coordinator, otherwise the leadership IDs
 * in the actor's scope: own engaged record for a leader, leaderships linked to
 * administered plazas for an advisor.
 */
export const getAccessibleLeadershipIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleLeadershipIDs> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignCoordinator(currentUser)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_LEADERSHIP_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const collections = req.payload.collections as Record<string, unknown>
  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  let ids: LeadershipID[] = []

  if (currentUser.role === 'leader') {
    const ownLeadership = await getOwnEngagedLeadership(req, currentUser)
    ids = ownLeadership ? [ownLeadership.id] : []
  }

  if (currentUser.role === 'advisor' && collections.leadership) {
    const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
    const result = await find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { id: true },
      where: {
        plazas: {
          in: plazaIDs ?? [],
        },
      },
    })

    ids = result.docs.map((doc) => relationshipId(doc.id)).filter((id): id is number => id !== null)
  }

  const uniqueIDs = [...new Set(ids)]
  context[cacheKey] = uniqueIDs

  return uniqueIDs
}

export const getAccessibleContactIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<ContactID[]> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  const leadershipWhere =
    currentUser.role === 'leader'
      ? {
          and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
        }
      : {
          plazas: {
            in: plazaIDs ?? [],
          },
        }

  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  const collections = req.payload.collections as Record<string, unknown>
  const contactIDs: ContactID[] = []

  if (collections.leadership) {
    const leadershipResult = await find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { contact: true },
      where: leadershipWhere,
    })
    for (const doc of leadershipResult.docs) {
      const id = relationshipId(doc.contact)
      if (id !== null) contactIDs.push(id)
    }
  }

  if (currentUser.role === 'advisor' && collections.supporter) {
    const supporterResult = await find({
      collection: 'supporter',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { contact: true },
      where: {
        plaza: {
          in: plazaIDs ?? [],
        },
      },
    })
    for (const doc of supporterResult.docs) {
      const id = relationshipId(doc.contact)
      if (id !== null) contactIDs.push(id)
    }
  }

  const ids = [...new Set(contactIDs)]
  context[cacheKey] = ids

  return ids
}

// ---------------------------------------------------------------------------
// Vote pledges (declared by the leader, estimated by staff)
// ---------------------------------------------------------------------------

export const canCreateVotePledge: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false

  const plazaID = relationshipId(data?.plaza)
  const leadershipID = relationshipId(data?.leadership)
  if (!plazaID || !leadershipID) return false

  if (isCampaignCoordinator(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
    return plazaIDs?.includes(plazaID) ?? false
  }

  const ownLeadership = await getOwnEngagedLeadership(req, currentUser)
  if (!ownLeadership) return false

  return ownLeadership.id === leadershipID && ownLeadership.plazaIDs.includes(plazaID)
}

export const canReadVotePledge: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  if (currentUser.role === 'advisor') {
    const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
    return {
      plaza: {
        in: plazaIDs ?? [],
      },
    }
  }

  const ownLeadership = await getOwnEngagedLeadership(req, currentUser)

  return {
    leadership: {
      in: ownLeadership ? [ownLeadership.id] : [],
    },
  }
}

/** Same row scope as read — the estimated fields are gated by field access. */
export const canUpdateVotePledge: Access = canReadVotePledge

export const canDeleteVotePledge: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Plaza updates (immutable field reports)
// ---------------------------------------------------------------------------

export const canCreatePlazaUpdate: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  const plazaID = relationshipId(data?.plaza)
  if (!plazaID) return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  return plazaIDs?.includes(plazaID) ?? false
}

export const canReadPlazaUpdate: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  const plazaScope: Where = {
    plaza: {
      in: plazaIDs ?? [],
    },
  }

  if (currentUser.role !== 'leader') return plazaScope

  return {
    and: [plazaScope, { author: { equals: currentUser.id } }],
  }
}

export const canMutatePlazaUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetPlazaUpdateAuthor: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Campaign invites
// ---------------------------------------------------------------------------

export const canCreateCampaignInvite: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const leadershipID = relationshipId(data?.leadership)
  if (!leadershipID) return false

  const accessibleLeadershipIDs = await getAccessibleLeadershipIds(req, currentUser)
  return accessibleLeadershipIDs?.includes(leadershipID) ?? false
}

export const canReadCampaignInvite: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const accessibleLeadershipIDs = await getAccessibleLeadershipIds(req, currentUser)

  return {
    leadership: {
      in: accessibleLeadershipIDs ?? [],
    },
  }
}

export const canMutateCampaignInvite: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetCampaignInviteSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Supporters
// ---------------------------------------------------------------------------

export const canCreateSupporter: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const plazaID = relationshipId(data?.plaza)
  if (!plazaID) return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  return plazaIDs?.includes(plazaID) ?? false
}

export const canReadSupporter: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)

  return {
    plaza: {
      in: plazaIDs ?? [],
    },
  }
}

export const canManageSupporter: Access = canReadSupporter

export const canDeleteSupporter: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const canCreateOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canReadOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignStaff(currentUser)) return true

  const ownLeadership = await getOwnEngagedLeadership(req, currentUser)

  return {
    id: {
      in: ownLeadership?.organizationIDs ?? [],
    },
  }
}

export const canManageOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canDeleteOrganization: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Campaign demands
// ---------------------------------------------------------------------------

export const canCreateCampaignDemand: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignCoordinator(currentUser)) return true

  const plazaID = relationshipId(data?.plaza)
  if (!plazaID) return false

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  return plazaIDs?.includes(plazaID) ?? false
}

export const canReadCampaignDemand: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignCoordinator(currentUser)) return true
  if (!currentUser) return false

  if (currentUser.role === 'advisor') {
    const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
    return {
      plaza: {
        in: plazaIDs ?? [],
      },
    }
  }

  const ownLeadership = await getOwnEngagedLeadership(req, currentUser)

  return {
    leadership: {
      in: ownLeadership ? [ownLeadership.id] : [],
    },
  }
}

/**
 * Same row scope as read: staff manage demands of their plazas; a leader may
 * edit only their own demand and only while it is still "aberta" (enforced in
 * the collection hook together with the staff-only field access).
 */
export const canUpdateCampaignDemand: Access = canReadCampaignDemand

export const canDeleteCampaignDemand: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Action plans
// ---------------------------------------------------------------------------

const canStaffCreateActionPlan: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canCreateActionPlan: Access = canStaffCreateActionPlan

export const canReadActionPlan: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (isCampaignCoordinator(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
    return {
      or: [
        {
          advisors: {
            contains: currentUser.id,
          },
        },
        {
          plaza: {
            in: plazaIDs ?? [],
          },
        },
      ],
    }
  }

  if (currentUser.role === 'leader') {
    const leadershipIDs = await getAccessibleLeadershipIds(req, currentUser)
    return {
      leadership: {
        in: leadershipIDs ?? [],
      },
    }
  }

  return false
}

/** Same row scope as read — leader write limits are enforced in `beforeChange`. */
export const canUpdateActionPlan: Access = canReadActionPlan

export const canDeleteActionPlan: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetActionPlanSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canSetActionPlanStatus: FieldAccess = canStaffCreateActionPlan

export const canCreateActionPlanAdvisors: FieldAccess = canStaffCreateActionPlan

export const canManageActionPlanAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}

// ---------------------------------------------------------------------------
// Election data
// ---------------------------------------------------------------------------

export type ElectionDataReader = CampaignUser | User

export const canReadElectionDataAsUser = (user: CampaignActor): user is ElectionDataReader =>
  isPayloadAdmin(user) || isCampaignUser(user)

export function assertCanReadElectionData(user: CampaignActor): asserts user is ElectionDataReader {
  if (!canReadElectionDataAsUser(user)) {
    throw new Error('Leitura de dados eleitorais negada.')
  }
}

/** Public TSE election data: any authenticated campaign or admin user may read. */
export const canReadElectionData: Access = ({ req }) => canReadElectionDataAsUser(req.user)

/** Election reference data is mutated only by Payload admins (or CLI with overrideAccess). */
export const canMutateElectionData: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Campaign user phone visibility
// ---------------------------------------------------------------------------

export const canReadCampaignUserPhone: FieldAccess = async ({ doc, id, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (id !== undefined && String(id) === String(currentUser.id)) return true
  if (isCampaignCoordinator(currentUser)) return true
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
      // Missing target only — fall through to the plaza-scope check.
    }
  }
  if (targetRole === 'coordinator') {
    context[cacheKey] = true
    return true
  }

  const plazaIDs = await getAccessiblePlazaIds(req, currentUser)
  if (!plazaIDs?.length) {
    context[cacheKey] = false
    return false
  }

  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  const result = await find({
    collection: 'plaza',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { id: true },
    where: {
      and: [{ id: { in: plazaIDs } }, { advisors: { contains: targetUserID } }],
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
