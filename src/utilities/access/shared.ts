// ---------------------------------------------------------------------------
// Shared internals of the campaign RBAC modules (`src/utilities/access/*`).
// Domain modules may import from here; this module must not import from them.
// ---------------------------------------------------------------------------

import type { CampaignUser, User } from '@/payload-types'
import type { Access, PayloadRequest, Where } from 'payload'

export type CampaignActor = CampaignUser | User | null | undefined

const FRESH_CAMPAIGN_USER_CONTEXT_KEY = 'campaignFreshUser'

/** Enough of a request for Local API calls inside an existing transaction. */
export type CampaignTransactionRequest = PayloadRequest | { transactionID: number | string }

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

export const isPayloadAdmin = (user: CampaignActor): user is User => user?.collection === 'users'

/**
 * Payload-admin-only collection access. Collections without explicit access fall
 * back to Payload's "any authenticated user" default — which includes campaign
 * users hitting `/api/*` with a `campaign-token` JWT — so every CMS/PII
 * collection must set this (or something stricter) explicitly.
 */
export const payloadAdminOnly: Access = ({ req }) => isPayloadAdmin(req.user)

export const isCampaignUser = (user: CampaignActor): user is CampaignUser =>
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
