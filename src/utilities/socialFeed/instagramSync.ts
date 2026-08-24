import 'server-only'

import type { SocialFeedSetting } from '@/payload-types'
import {
  getPostgresTransactionDatabase,
  type PostgresTransactionDatabase,
} from '@/utilities/postgresTransactionLocks'
import {
  describeInstagramError,
  failedInstagramSyncStatus,
  INSTAGRAM_MAX_RESULTS_CAP,
  isInstagramFeedConfigured,
  loadInstagramFeed,
  persistInstagramAccessToken,
  persistInstagramSnapshot,
  persistInstagramSyncStatus,
  successInstagramSyncStatus,
  type InstagramSyncStatus,
} from '@/utilities/socialFeed/instagramFeed'
import type { Payload, PayloadRequest } from 'payload'

/** Deadline for the admin retry button (`POST /api/social-feed/sync`) — a
 * hanging Graph API must never stall the request. The hook uses the shorter
 * `INSTAGRAM_SYNC_HOOK_TIMEOUT_MS` (its fetch runs inside the save's
 * transaction). */
export const INSTAGRAM_SYNC_TIMEOUT_MS = 10_000

/** Deadline for the hook-triggered sync only (S11-FOLLOWUP): the afterChange
 * hook runs INSIDE the save's transaction, holding the `social_feed_settings`
 * row lock for its whole duration — the fetch must not stretch that lock
 * window beyond ~5s. The retry button keeps the 10s headroom (no transaction
 * is open there, so its fetch holds no lock and needs room for the refresh +
 * retry round trips). */
export const INSTAGRAM_SYNC_HOOK_TIMEOUT_MS = 5_000

export type InstagramSyncOutcome = {
  ok: boolean
  status: InstagramSyncStatus
}

/**
 * True when a save of the global must re-sync Instagram: the credentials
 * changed (the primary flow — "fill token + ID, save, see the state") or the
 * feed was re-enabled. Exclusion-only saves skip the sync on purpose: they
 * change no credential and would burn an API call for nothing.
 */
export const instagramCredentialsChanged = (
  doc: SocialFeedSetting,
  previousDoc: SocialFeedSetting | null | undefined,
): boolean => {
  if (!previousDoc) return true
  const credentialsChanged =
    (doc.instagramAccessToken ?? '') !== (previousDoc.instagramAccessToken ?? '') ||
    (doc.instagramUserId ?? '') !== (previousDoc.instagramUserId ?? '')
  const reenabled = doc.instagramEnabled === true && previousDoc.instagramEnabled !== true
  return credentialsChanged || reenabled
}

/**
 * The afterChange hook runs INSIDE the global save's transaction (the row lock
 * is held until it returns), so a write to the same row from a second pool
 * connection would block on that lock. When a `req` with a `transactionID` is
 * present (hook path), the persists go through the transaction-bound database
 * instead — the status/snapshot land atomically with the save, no deadlock.
 * The render path and the sync route have no open transaction and keep the
 * pool (`payload.db.drizzle`).
 */
const resolvePersistDatabase = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<PostgresTransactionDatabase | null> => {
  if (!req?.transactionID) return null
  try {
    return await getPostgresTransactionDatabase(payload, req)
  } catch {
    // No transaction adapter available (e.g. non-postgres in tests) — pool.
    return null
  }
}

/**
 * Runs one Instagram sync from the persisted settings: fetches the Graph API,
 * persists the raw snapshot + a refreshed token when one was minted, and
 * writes the outcome status. Never throws — the status IS the result (a
 * failure writes the product-language reason the admin panel shows). Shared
 * by the global's `afterChange` hook (on credential change) and the
 * `POST /api/social-feed/sync` route (the "Tentar sincronizar de novo"
 * button) — one implementation, two call sites.
 */
export const syncInstagramFeed = async (
  payload: Payload,
  options: { signal?: AbortSignal; req?: PayloadRequest } = {},
): Promise<InstagramSyncOutcome> => {
  const settings = await payload.findGlobal({
    slug: 'social-feed-settings',
    depth: 0,
  })

  if (!isInstagramFeedConfigured(settings)) {
    return { ok: false, status: {} }
  }

  const maxItems = Math.min(Math.max(settings.instagramMaxItems ?? 3, 1), 5)
  const database = await resolvePersistDatabase(payload, options.req)

  try {
    const result = await loadInstagramFeed({
      accessToken: settings.instagramAccessToken as string,
      userId: settings.instagramUserId as string,
      maxResults: Math.min(maxItems + 10, INSTAGRAM_MAX_RESULTS_CAP),
      signal: options.signal,
    })
    await persistInstagramSnapshot(
      payload,
      { username: result.username, posts: result.posts },
      database,
    )
    if (result.refreshedAccessToken) {
      await persistInstagramAccessToken(payload, result.refreshedAccessToken, database)
    }
    const status = successInstagramSyncStatus(result.posts.length)
    await persistInstagramSyncStatus(payload, status, database)
    return { ok: true, status }
  } catch (cause) {
    const status = failedInstagramSyncStatus(describeInstagramError(cause))
    await persistInstagramSyncStatus(payload, status, database)
    return { ok: false, status }
  }
}
