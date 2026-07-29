// ---------------------------------------------------------------------------
// Leaderships
// ---------------------------------------------------------------------------

import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import type { CampaignActor, DynamicFind } from '@/utilities/access/shared'
import {
  advisorMunicipalityScopeWhere,
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveAccessibleIds,
  resolveActorScopedRead,
} from '@/utilities/access/shared'

type LeadershipID = number
type AccessibleLeadershipIDs = LeadershipID[] | null

const ACCESSIBLE_LEADERSHIP_IDS_MEMO_KEY = 'campaignAccessibleLeadershipIds'

export const canSetAdministrativeLeadershipField: FieldAccess = ({ req }) =>
  isPayloadAdmin(req.user)

const municipalityIDsFromData = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

export const canReadLeadership: Access = ({ req }) =>
  resolveActorScopedRead(req, 'municipalities', getAccessibleMunicipalityIds)

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

  return advisorMunicipalityScopeWhere(
    'municipalities',
    await getAccessibleMunicipalityIds(req, currentUser),
  )
}

export const canDeleteLeadership: Access = ({ req }) => isPayloadAdmin(req.user)

/**
 * Returns null for unrestricted roles, otherwise the leadership IDs
 * in the actor's scope: own engaged record for a leader, leaderships linked to
 * administered municipalities for an advisor.
 */
export const getAccessibleLeadershipIds = (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleLeadershipIDs> =>
  resolveAccessibleIds(req, user, ACCESSIBLE_LEADERSHIP_IDS_MEMO_KEY, async (currentUser) => {
    const collections = req.payload.collections as Record<string, unknown>
    const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
    let ids: LeadershipID[] = []

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
        where: advisorMunicipalityScopeWhere('municipalities', municipalityIDs),
      })

      ids = result.docs
        .map((doc) => relationshipId(doc.id))
        .filter((id): id is number => id !== null)
    }

    return [...new Set(ids)]
  })
