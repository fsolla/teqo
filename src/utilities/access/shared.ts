// ---------------------------------------------------------------------------
// Shared internals of the campaign RBAC modules (`src/utilities/access/*`).
// Domain modules may import from here; this module must not import from them.
// ---------------------------------------------------------------------------

import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser, User } from '@/payload-types'
import type { Access, PayloadRequest, Where } from 'payload'

export type CampaignActor = CampaignUser | User | null | undefined

const FRESH_CAMPAIGN_USER_MEMO_KEY = 'campaignFreshUser'

/**
 * Per-request memo for the reads the RBAC modules repeat (fresh actor, accessible
 * ids). Keyed on the `req` OBJECT, deliberately not on `req.context`.
 *
 * `req.context` cannot hold this: `createLocalReq` reassigns `req.context` to a
 * fresh copy on every nested Local API call, and a `depth: 1` populate makes one
 * per batched collection — while field-level access runs concurrently against
 * whatever object `req.context` points at at that instant, so writes land on an
 * object the next nested find has already replaced. Measured on
 * `/campanha/liderancas`: 367 calls into `getFreshCampaignUser`, **367 distinct
 * `req.context` objects, one `req`**. Keying on `req` gives the scope
 * `req.context` was meant to give and expires with it (WeakMap).
 *
 * The PENDING PROMISE is stored, not the resolved value: `traverseFields` starts
 * every field's access check before any of them settles, so memoizing only the
 * result still lets hundreds of identical reads leave together.
 */
const memosByRequest = new WeakMap<object, Map<string, Promise<unknown>>>()

export const memoizePerRequest = <T>(
  req: PayloadRequest,
  key: string,
  load: () => Promise<T>,
): Promise<T> => {
  let memo = memosByRequest.get(req)
  if (!memo) {
    memo = new Map()
    memosByRequest.set(req, memo)
  }

  const cached = memo.get(key)
  if (cached) return cached as Promise<T>

  const pending = load()
  memo.set(key, pending)
  // A failed read must not poison the rest of the request; the caller still gets
  // this rejection, and `.catch` here only marks this branch as handled.
  pending.catch(() => {
    if (memo.get(key) === pending) memo.delete(key)
  })

  return pending
}

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

export const getFreshCampaignUser = (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<CampaignUser | null> => {
  if (!isCampaignUser(user)) return Promise.resolve(null)

  return memoizePerRequest(req, `${FRESH_CAMPAIGN_USER_MEMO_KEY}:${user.id}`, async () => {
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
  })
}

// ---------------------------------------------------------------------------
// Named scope policies (Pass 3 P3-D). The advisor-scope fragment and the
// scoped-read prologue live ONCE here; the convention guard in
// `codebaseConventions.unit.spec.ts` fails the build on a domain module that
// re-spells `{ municipality(s): { in: ids ?? [] } }`.
// ---------------------------------------------------------------------------

/** `{ [field]: { in: ids ?? [] } }` — the ONE spelling of the advisor scope fragment. */
export const advisorMunicipalityScopeWhere = (
  field: 'municipality' | 'municipalities',
  ids: readonly number[] | null,
): Where => ({ [field]: { in: ids ?? [] } })

/**
 * The scoped-read prologue every staff collection shares: admin → all, leader →
 * nothing, unrestricted → all, advisor → its municipality scope on `scopeField`,
 * anyone else → nothing. `loadAccessibleIds` is a parameter because this module
 * must not import the domain modules (cycle) — call sites pass
 * `getAccessibleMunicipalityIds`.
 */
export const resolveActorScopedRead = async (
  req: PayloadRequest,
  scopeField: 'municipality' | 'municipalities',
  loadAccessibleIds: (
    req: PayloadRequest,
    user: CampaignActor,
  ) => Promise<readonly number[] | null>,
): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  return advisorMunicipalityScopeWhere(scopeField, await loadAccessibleIds(req, currentUser))
}

/**
 * C141 — same scoped-read prologue as `resolveActorScopedRead`, but the
 * advisor's configured Visão profile widens the scope: `tudo` → the whole
 * catalog. Only NON-sensitive collections use this variant — demands (C143
 * owns the rule) and supporters (PII cap) keep the carteira-only prologue, so
 * Visão "Tudo" can never open them.
 */
export const resolveProfileScopedRead = async (
  req: PayloadRequest,
  scopeField: 'municipality' | 'municipalities',
  loadAccessibleIds: (
    req: PayloadRequest,
    user: CampaignActor,
  ) => Promise<readonly number[] | null>,
): Promise<boolean | Where> => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignLeader(currentUser)) return false
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false
  if (currentUser.visibility === 'tudo') return true

  return advisorMunicipalityScopeWhere(scopeField, await loadAccessibleIds(req, currentUser))
}

/**
 * C141 — the advisor's Edição axis as a write-scope decision. `somente_leitura`
 * → 'none' (no writes anywhere), `tudo` → 'tudo' (writes across the visible
 * catalog, minus coordination fields), `carteira` → today's portfolio scope.
 * Callers resolve admin/unrestricted first and keep their own where shape for
 * the carteira branch; non-advisor actors resolve 'none' here and are handled
 * by their own branches.
 */
export const advisorEditingAccess = (user: CampaignActor): 'none' | 'carteira' | 'tudo' => {
  if (!isCampaignUser(user) || user.role !== 'advisor') return 'none'
  if (user.editing === 'somente_leitura') return 'none'
  if (user.editing === 'tudo') return 'tudo'
  return 'carteira'
}

/**
 * The memoized "accessible ids" engine the three scope resolvers share
 * (municipalities, leaderships, contacts). Owns the fresh-user one-liner, the
 * non-campaign → `[]` and unrestricted → `null` conventions, and the per-request
 * memo key; `compute` runs the domain-specific query and may itself return
 * `null` (C141 — an advisor with Visão "Tudo" resolves to the whole catalog).
 */
export const resolveAccessibleIds = async <ID>(
  req: PayloadRequest,
  user: CampaignActor = req.user,
  memoKey: string,
  compute: (currentUser: CampaignUser) => Promise<ID[] | null>,
): Promise<ID[] | null> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignUnrestricted(currentUser)) return null

  return memoizePerRequest(req, `${memoKey}:${currentUser.id}:${currentUser.role}`, () =>
    compute(currentUser),
  )
}
