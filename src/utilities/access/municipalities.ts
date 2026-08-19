// ---------------------------------------------------------------------------
// Municipalities (Municípios)
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, Payload, PayloadRequest } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'
import type {
  CampaignActor,
  CampaignTransactionRequest,
  DynamicFind,
} from '@/utilities/access/shared'
import {
  advisorEditingAccess,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignUnrestricted,
  isCampaignUser,
  isPayloadAdmin,
  memoizePerRequest,
  resolveAccessibleIds,
} from '@/utilities/access/shared'

type MunicipalityID = number
type AccessibleMunicipalityIDs = MunicipalityID[] | null

const ACCESSIBLE_MUNICIPALITY_IDS_MEMO_KEY = 'campaignAccessibleMunicipalityIds'
const OWN_LEADERSHIP_MEMO_KEY = 'campaignOwnLeadership'

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
const getOwnEngagedLeadership = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<OwnLeadership> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user
  if (!isCampaignUser(currentUser)) return null

  return memoizePerRequest(req, `${OWN_LEADERSHIP_MEMO_KEY}:${currentUser.id}`, async () => {
    const collections = req.payload.collections as Record<string, unknown>
    if (!collections.leadership) return null

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
    if (!doc) return null

    const id = relationshipId(doc.id)
    if (id === null) return null

    return {
      id,
      municipalityIDs: (Array.isArray(doc.municipalities) ? doc.municipalities : [])
        .map(relationshipId)
        .filter((value): value is number => value !== null),
      organizationIDs: (Array.isArray(doc.organizations) ? doc.organizations : [])
        .map(relationshipId)
        .filter((value): value is number => value !== null),
    }
  })
}

/**
 * Returns null for the unrestricted coordinator, otherwise the municipality IDs the
 * authenticated campaign user can operate on: administered municipalities for an
 * advisor, linked (engaged) municipalities for a leader.
 */
export const getAccessibleMunicipalityIds = (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleMunicipalityIDs> =>
  resolveAccessibleIds(req, user, ACCESSIBLE_MUNICIPALITY_IDS_MEMO_KEY, async (currentUser) => {
    const collections = req.payload.collections as Record<string, unknown>
    let ids: MunicipalityID[] = []

    if (currentUser.role === 'advisor' && collections.municipality) {
      ids = await getAdvisorMunicipalityIds(req.payload, currentUser.id, req)
    }

    if (currentUser.role === 'leader') {
      const ownLeadership = await getOwnEngagedLeadership(req, currentUser)
      ids = ownLeadership?.municipalityIDs ?? []
    }

    return [...new Set(ids)]
  })

/**
 * C141 — municipality IDs an advisor may WRITE under the Edição axis: `null`
 * (whole catalog) for unrestricted staff and `editing === 'tudo'`, the carteira
 * ids for `editing === 'carteira'`, `[]` for `somente_leitura`. Takes the FRESH
 * user (callers inside transactions already reloaded it) so it works with only
 * a `{ transactionID }` request, mirroring `getAdvisorMunicipalityIds`. The
 * tour (giro) batch check uses this because `canCreateActivity` is a plain
 * staff boolean and cannot express a per-município constraint on create.
 * Deliberately distinct from `getAccessibleMunicipalityIds` (which stays the
 * carteira scope): the latter feeds PII surfaces — supporters, account phones,
 * feeds — that the gate caps on the carteira on BOTH profile axes.
 */
export const getWritableMunicipalityIds = async (
  payload: Pick<Payload, 'find'>,
  currentUser: CampaignUser,
  req?: CampaignTransactionRequest,
): Promise<AccessibleMunicipalityIDs> => {
  if (isCampaignUnrestricted(currentUser)) return null

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return []
  if (editingAccess === 'tudo') return null

  return getAdvisorMunicipalityIds(payload, currentUser.id, req)
}

/** Municipalities are seeded by migration; nobody creates or deletes them in the app. */
export const canCreateMunicipality: Access = ({ req }) => isPayloadAdmin(req.user)

export const canReadMunicipality: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  // Editors (and any non-campaign actor) must not see Municípios in /admin.
  if (!currentUser) return false
  if (isCampaignLeader(currentUser)) return false
  // C141 — Visão "Tudo": the advisor sees the whole catalog (panorama,
  // cobertura); supporters, demands and feeds keep their own narrower gates.
  if (currentUser.role === 'advisor' && currentUser.visibility === 'tudo') return true

  const ids = await getAccessibleMunicipalityIds(req, currentUser)
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
  if (!currentUser) return false
  if (isCampaignUnrestricted(currentUser)) return true

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false
  if (editingAccess === 'tudo') return true

  return {
    advisors: {
      contains: currentUser.id,
    },
  }
}

export const canDeleteMunicipality: Access = ({ req }) => isPayloadAdmin(req.user)

/**
 * Fields only the coordination itself may write. The two policies below are
 * named apart because they answer different questions and can diverge, but
 * they resolve "unrestricted staff" once so a change to what that means is
 * made in one place.
 */
const unrestrictedCampaignFieldAccess: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

/** Advisor assignment is unrestricted staff (coordinator + candidate; actions use overrideAccess). */
export const canAssignMunicipalityAdvisors = unrestrictedCampaignFieldAccess

export const canManageMunicipalityAdvisors: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

/**
 * E14 — moving a município between engagement levels is a reallocation
 * decision, so it is unrestricted staff only; the advisor proposes it through
 * a signal. Reading stays with `canReadCampaignStaffField` like the rest of
 * the staff block.
 */
export const canManageMunicipalityEngagementLevel = unrestrictedCampaignFieldAccess
