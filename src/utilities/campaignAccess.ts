import type { CampaignUser, User } from '@/payload-types'
import type { Access, FieldAccess, Payload, PayloadRequest, Where } from 'payload'

import { relationshipId } from '@/utilities/relationship'

type CampaignActor = CampaignUser | User | null | undefined
type MunicipalityID = number
type AccessibleMunicipalityIDs = MunicipalityID[] | null
type ContactID = number
type LeadershipID = number
type AccessibleLeadershipIDs = LeadershipID[] | null

const ACCESSIBLE_PLAZA_IDS_CONTEXT_KEY = 'campaignAccessibleMunicipalityIds'
const ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY = 'campaignAccessibleContactIds'
const ACCESSIBLE_LEADERSHIP_IDS_CONTEXT_KEY = 'campaignAccessibleLeadershipIds'
const OWN_LEADERSHIP_CONTEXT_KEY = 'campaignOwnLeadership'
const CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY = 'campaignUserPhoneAccess'
const FRESH_CAMPAIGN_USER_CONTEXT_KEY = 'campaignFreshUser'

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

/**
 * Payload-admin-only collection access. Collections without explicit access fall
 * back to Payload's "any authenticated user" default — which includes campaign
 * users hitting `/api/*` with a `campaign-token` JWT — so every CMS/PII
 * collection must set this (or something stricter) explicitly.
 */
export const payloadAdminOnly: Access = ({ req }) => isPayloadAdmin(req.user)

const isCampaignUser = (user: CampaignActor): user is CampaignUser =>
  user?.collection === 'campaignUser'

/** "Coordenador Geral" — unrestricted campaign coordination. */
export const isCampaignCoordinator = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'coordinator'

/** "Candidato" — full campaign visibility (superset of coordinator for reads). */
export const isCampaignCandidate = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'candidate'

/** Coordinator or candidate — unrestricted scope (all municipalities, decisions). */
export const isCampaignUnrestricted = (user: CampaignActor): boolean =>
  isCampaignCoordinator(user) || isCampaignCandidate(user)

export const isCampaignLeader = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'leader'

/** Staff = coordinator, advisor, or candidate. Leaders are not staff. */
export const isCampaignStaff = (user: CampaignActor): boolean =>
  isCampaignUser(user) &&
  (user.role === 'coordinator' || user.role === 'advisor' || user.role === 'candidate')

/** Eligible relationship targets for advisor assignments (municipality / action plan). */
export const eligibleCampaignStaffWhere: Where = {
  or: [{ role: { equals: 'coordinator' } }, { role: { equals: 'advisor' } }],
}

export const getFreshCampaignUser = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<CampaignUser | null> => {
  if (!isCampaignUser(user)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${FRESH_CAMPAIGN_USER_CONTEXT_KEY}:${user.id}`
  if (cacheKey in context) return context[cacheKey] as CampaignUser | null

  let fresh: CampaignUser | null = null
  try {
    fresh = await req.payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    fresh = null
  }

  context[cacheKey] = fresh
  return fresh
}

// ---------------------------------------------------------------------------
// Campaign users
// ---------------------------------------------------------------------------

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
// Municipalities (Praças)
// ---------------------------------------------------------------------------

/**
 * Municipality IDs where `advisorID` is an assigned advisor, without requiring a
 * `PayloadRequest`. Canonical implementation of the "advisors contains
 * user.id" lookup; `getAccessibleMunicipalityIds` uses it for its (request-scoped,
 * context-cached) advisor branch.
 */
export const getAdvisorMunicipalityIds = async (
  payload: Pick<Payload, 'find'>,
  advisorID: number,
  req?: CampaignTransactionRequest,
): Promise<number[]> => {
  const find = payload.find.bind(payload) as unknown as DynamicFind
  const result = await find({
    collection: 'municipality',
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

/**
 * Municipality IDs linked to `userID`'s engaged leadership, without requiring a
 * `PayloadRequest`. Transaction-safe counterpart of the leader branch in
 * `getAccessibleMunicipalityIds`, for server actions running inside
 * `withPayloadTransaction` (where only `{ transactionID }` is available).
 */
export const getEngagedLeaderMunicipalityIds = async (
  payload: Pick<Payload, 'find'>,
  userID: number,
  req?: CampaignTransactionRequest,
): Promise<number[]> => {
  const find = payload.find.bind(payload) as unknown as DynamicFind
  const result = await find({
    collection: 'leadership',
    where: {
      and: [{ user: { equals: userID } }, { supportStatus: { equals: 'engajado' } }],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { municipalities: true },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  const doc = result.docs[0]
  return (Array.isArray(doc?.municipalities) ? doc.municipalities : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
}

type OwnLeadership = { id: number; municipalityIDs: number[]; organizationIDs: number[] } | null

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
      select: { municipalities: true, organizations: true },
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
          municipalityIDs: (Array.isArray(doc.municipalities) ? doc.municipalities : [])
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
 * Returns null for the unrestricted coordinator, otherwise the municipality IDs the
 * authenticated campaign user can operate on: administered municipalities for an
 * advisor, linked (engaged) municipalities for a leader.
 */
export const getAccessibleMunicipalityIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleMunicipalityIDs> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignUnrestricted(currentUser)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_PLAZA_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const collections = req.payload.collections as Record<string, unknown>
  let ids: MunicipalityID[] = []

  if (currentUser.role === 'advisor' && collections.municipality) {
    ids = await getAdvisorMunicipalityIds(req.payload, currentUser.id, req)
  }

  if (currentUser.role === 'leader') {
    const ownLeadership = await getOwnEngagedLeadership(req, currentUser)
    ids = ownLeadership?.municipalityIDs ?? []
  }

  const uniqueIDs = [...new Set(ids)]
  context[cacheKey] = uniqueIDs

  return uniqueIDs
}

/** Municipalities are seeded by migration; nobody creates or deletes them in the app. */
export const canCreateMunicipality: Access = ({ req }) => isPayloadAdmin(req.user)

export const canReadMunicipality: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false

  const ids = await getAccessibleMunicipalityIds(req)
  if (ids === null) return true

  return {
    id: {
      in: ids,
    },
  }
}

export const canUpdateMunicipality: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  return {
    advisors: {
      contains: currentUser.id,
    },
  }
}

export const canDeleteMunicipality: Access = ({ req }) => isPayloadAdmin(req.user)

/** Advisor assignment is coordinator-only (server actions use overrideAccess). */
export const canAssignMunicipalityAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignCoordinator(await getFreshCampaignUser(req))
}

export const canManageMunicipalityAdvisors: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const canReadContacts: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
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

const municipalityIDsFromData = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

export const canReadLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)

  return {
    municipalities: {
      in: municipalityIDs ?? [],
    },
  }
}

export const canCreateLeadership: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const requestedMunicipalityIDs = municipalityIDsFromData(data?.municipalities)
  if (requestedMunicipalityIDs.length === 0) return false

  const accessibleMunicipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  if (accessibleMunicipalityIDs === null) return true

  return requestedMunicipalityIDs.every((id) => accessibleMunicipalityIDs.includes(id))
}

export const canManageLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)

  return {
    municipalities: {
      in: municipalityIDs ?? [],
    },
  }
}

export const canDeleteLeadership: Access = ({ req }) => isPayloadAdmin(req.user)

/**
 * Returns null for unrestricted roles, otherwise the leadership IDs
 * in the actor's scope: own engaged record for a leader, leaderships linked to
 * administered municipalities for an advisor.
 */
export const getAccessibleLeadershipIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleLeadershipIDs> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignUnrestricted(currentUser)) return null

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
    ids = []
  }

  if (currentUser.role === 'advisor' && collections.leadership) {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    const result = await find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { id: true },
      where: {
        municipalities: {
          in: municipalityIDs ?? [],
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

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  const leadershipWhere =
    currentUser.role === 'leader'
      ? {
          and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
        }
      : {
          municipalities: {
            in: municipalityIDs ?? [],
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
        municipality: {
          in: municipalityIDs ?? [],
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
// Vote pledges (declared by staff, estimated by staff)
// ---------------------------------------------------------------------------

export const canCreateVotePledge: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false

  const municipalityID = relationshipId(data?.municipality)
  const leadershipID = relationshipId(data?.leadership)
  if (!municipalityID || !leadershipID) return false

  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  return false
}

export const canReadVotePledge: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    municipality: {
      in: municipalityIDs ?? [],
    },
  }
}

/** Same row scope as read — the estimated fields are gated by field access. */
export const canUpdateVotePledge: Access = canReadVotePledge

export const canDeleteVotePledge: Access = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Municipality updates (immutable field reports)
// ---------------------------------------------------------------------------

export const canCreateMunicipalityUpdate: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}

export const canReadMunicipalityUpdate: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser) return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    municipality: {
      in: municipalityIDs ?? [],
    },
  }
}

export const canMutateMunicipalityUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetMunicipalityUpdateAuthor: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

// ---------------------------------------------------------------------------
// Campaign invites
// ---------------------------------------------------------------------------

export const canCreateCampaignInvite: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser?.role !== 'advisor') return false

  const leadershipID = relationshipId(data?.leadership)
  if (!leadershipID) return false

  const accessibleLeadershipIDs = await getAccessibleLeadershipIds(req, currentUser)
  return accessibleLeadershipIDs?.includes(leadershipID) ?? false
}

export const canReadCampaignInvite: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
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
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  if (currentUser?.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return municipalityIDs?.includes(municipalityID) ?? false
  }

  if (isCampaignLeader(currentUser)) {
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
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return {
      municipality: {
        in: municipalityIDs ?? [],
      },
    }
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
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignStaff(currentUser)) return true

  return false
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
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const municipalityID = relationshipId(data?.municipality)
  if (!municipalityID) return false

  if (currentUser.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
}

export const canReadCampaignDemand: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return {
    municipality: {
      in: municipalityIDs ?? [],
    },
  }
}

/**
 * Staff manage demands in their municipalities; leaders have no demand access.
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
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true

  if (currentUser.role === 'advisor') {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    return {
      or: [
        {
          advisors: {
            contains: currentUser.id,
          },
        },
        {
          municipality: {
            in: municipalityIDs ?? [],
          },
        },
      ],
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
  isPayloadAdmin(user) || isCampaignStaff(user)

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

// ---------------------------------------------------------------------------
// State deputies (dobradinhas)
// ---------------------------------------------------------------------------

export const canCreateStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canReadStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canManageStateDeputy: Access = canReadStateDeputy

export const canDeleteStateDeputy: Access = ({ req }) => isPayloadAdmin(req.user)
