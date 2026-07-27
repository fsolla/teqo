// ---------------------------------------------------------------------------
// Shared internals of the campaign RBAC modules (`src/utilities/access/*`).
// Domain modules may import from here; this module must not import from them.
// ---------------------------------------------------------------------------

import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser, User } from '@/payload-types'
import type { Access, PayloadRequest, Where } from 'payload'

export type CampaignActor = CampaignUser | User | null | undefined

const FRESH_CAMPAIGN_USER_CONTEXT_KEY = 'campaignFreshUser'

/** Enough of a request for Local API calls inside an existing transaction. */
export type CampaignTransactionRequest = PayloadRequest | { transactionID: number | string }

/**
 * Narrow `payload.find` signature for helpers that query a collection chosen
 * at runtime (Payload's generic can't be proven then). Call sites use the
 * sanctioned `payload.find as unknown as DynamicFind` cast — the ONE approved
 * spelling of that cast; keep the queried fields inside this arg shape so the
 * casts stay honest.
 */
export type DynamicFind = (args: {
  collection: string
  depth: number
  limit: number
  overrideAccess: true
  pagination: false
  req?: CampaignTransactionRequest
  select: Record<string, true>
  where: Record<string, unknown>
}) => Promise<{ docs: Array<Record<string, unknown>> }>

/** Narrow to the Payload `users` collection (admin or editor). */
const isPayloadUsersActor = (user: CampaignActor): user is User => user?.collection === 'users'

/**
 * True Payload admin — `users` collection AND the `admin` role.
 * Fails closed when `roles` is missing or empty (pre-migration JWTs, stripped
 * fields). Returns boolean (not `user is User`) so a false result does not
 * erase editors from the User union after panel narrowing.
 */
export const isPayloadAdmin = (user: CampaignActor): boolean =>
  isPayloadUsersActor(user) && (user.roles?.includes('admin') ?? false)

/** Editorial staff: `users` with the `editor` role (may also be admin). */
export const isPayloadEditor = (user: CampaignActor): boolean =>
  isPayloadUsersActor(user) && (user.roles?.includes('editor') ?? false)

/** May open `/admin` — admin or editor. */
export const hasPayloadPanelAccess = (user: CampaignActor): user is User =>
  isPayloadUsersActor(user) && (isPayloadAdmin(user) || isPayloadEditor(user))

/**
 * Payload-admin-only collection access. Collections without explicit access fall
 * back to Payload's "any authenticated user" default — which includes campaign
 * users hitting `/api/*` with a `campaign-token` JWT — so every CMS/PII
 * collection must set this (or something stricter) explicitly.
 */
export const payloadAdminOnly: Access = ({ req }) => isPayloadAdmin(req.user)

/** Admin or editor — write access to public published content (`post`/`tag`/`media`). */
export const canManagePublishedContent: Access = ({ req }) => hasPayloadPanelAccess(req.user)

export const isCampaignUser = (user: CampaignActor): user is CampaignUser =>
  user?.collection === 'campaignUser'

/** "Coordenador Geral" — unrestricted campaign coordination. */
export const isCampaignCoordinator = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'coordinator'

/** Coordinator or candidate — unrestricted scope (all municipalities, decisions). */
export const isCampaignUnrestricted = (user: CampaignActor): boolean =>
  isCampaignUser(user) && isUnrestrictedCampaignRole(user.role)

export const isCampaignLeader = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'leader'

/** Staff = coordinator, advisor, or candidate. Leaders are not staff. */
export const isCampaignStaff = (user: CampaignActor): boolean =>
  isCampaignUser(user) && isStaffCampaignRole(user.role)

/**
 * Eligible relationship targets for advisor assignments (municipality / activity).
 * The candidate is included: the projection sheet lists him as the responsible contact
 * for some municipalities (decision 2026-07-24).
 */
export const eligibleCampaignStaffWhere: Where = {
  or: [
    { role: { equals: 'coordinator' } },
    { role: { equals: 'advisor' } },
    { role: { equals: 'candidate' } },
  ],
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
