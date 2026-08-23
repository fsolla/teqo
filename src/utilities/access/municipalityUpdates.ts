// ---------------------------------------------------------------------------
// Municipality updates (immutable field reports)
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
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveProfileScopedRead,
} from '@/utilities/access/shared'

/**
 * C88 — the only writes a staff campaign user may make to an update. Each kind
 * narrows the row scope and the fields that may change (the collection's
 * `beforeChange` allowlists them). Shared with the collection config so the
 * gate and the hook never drift.
 */
export const MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS: ReadonlySet<string> = new Set([
  'assignResponsible',
  'appendComment',
  'resolve',
  'reopen',
])

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

const canDeliberateUnrestricted = async (req: PayloadRequest): Promise<boolean> => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

/**
 * C88 — update gate by `context.mutationKind`. Out of the deliberative set
 * nothing changes (admin keeps the raw update path); `assignResponsible`,
 * `resolve` and `reopen` are coordinator/candidate (unrestricted) decisions;
 * `appendComment` follows the create rule — whoever can register an update in
 * that municipality may comment on it — expressed as a row `Where` so an
 * advisor outside the portfolio cannot touch the row at all.
 */
export const canUpdateMunicipalityUpdate: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const mutationKind = req.context?.mutationKind
  if (
    typeof mutationKind !== 'string' ||
    !MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS.has(mutationKind)
  ) {
    return false
  }

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false

  if (
    mutationKind === 'assignResponsible' ||
    mutationKind === 'resolve' ||
    mutationKind === 'reopen'
  ) {
    return isCampaignUnrestricted(currentUser)
  }

  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser.role !== 'advisor') return false

  const editingAccess = advisorEditingAccess(currentUser)
  if (editingAccess === 'none') return false
  if (editingAccess === 'tudo') return true

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return advisorMunicipalityScopeWhere('municipality', municipalityIDs)
}

export const canDeleteMunicipalityUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

/**
 * C88 — field gate for `responsible` (assign/clear): coordinator/candidate only.
 */
export const canAssignUpdateResponsible: FieldAccess = ({ req }) => canDeliberateUnrestricted(req)

/**
 * C88 — field gate for `resolvedBy`/`resolvedAt`: coordinator/candidate only.
 */
export const canResolveMunicipalityUpdate: FieldAccess = ({ req }) => canDeliberateUnrestricted(req)

/**
 * C88 — field gate for `comments` (the append path): the same profile rule as
 * `canCreateMunicipalityUpdate` without the per-row data — the collection
 * update gate already scopes the row for advisors.
 */
export const canCommentOnMunicipalityUpdate: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (currentUser.role !== 'advisor') return false

  return advisorEditingAccess(currentUser) !== 'none'
}

/** System-stamped comment fields (`author`/`createdAt`): admin only. */
export const canSetMunicipalityUpdateSystemField: FieldAccess = ({ req }) =>
  isPayloadAdmin(req.user)

export const canSetMunicipalityUpdateAuthor: FieldAccess = canSetMunicipalityUpdateSystemField

export type MunicipalityUpdateDeliberationCapabilities = {
  canAssign: boolean
  canComment: boolean
  canResolve: boolean
}

/**
 * C88 — the ONLY spelling of "assignable staff": advisors of the given
 * municipalities plus coordinator/candidate (unrestricted). The server action
 * and the feed loader both build their `campaignUser` query from this fragment
 * so the UI options and the save validation can never drift. Leaders are
 * never assignable.
 */
export const assignableUpdateStaffWhere = (advisorIDs: readonly number[]): Where => ({
  or: [
    { id: { in: [...advisorIDs] } },
    { role: { equals: 'coordinator' } },
    { role: { equals: 'candidate' } },
  ],
})

/**
 * C88 — the actor's deliberation capabilities, mirroring the access predicates
 * above: assign/resolve are coordinator/candidate decisions; commenting follows
 * the create rule (staff who can register updates may comment). Pure — the
 * server VM resolves it so the client never decides permission.
 */
export const resolveMunicipalityUpdateCapabilities = (
  user: CampaignUser | null | undefined,
): MunicipalityUpdateDeliberationCapabilities => {
  if (!user || isCampaignLeader(user)) {
    return { canAssign: false, canComment: false, canResolve: false }
  }
  if (isCampaignUnrestricted(user)) {
    return { canAssign: true, canComment: true, canResolve: true }
  }
  if (user.role === 'advisor') {
    return {
      canAssign: false,
      canComment: advisorEditingAccess(user) !== 'none',
      canResolve: false,
    }
  }
  return { canAssign: false, canComment: false, canResolve: false }
}
