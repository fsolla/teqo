/**
 * C230-followup — shared impure plumbing of the Instagram content ops CLIs
 * (`content:instagram:import` and `content:instagram:withdraw`): the window of
 * the own profile's official feed read with the global's credential (fail-
 * closed, refreshed token persisted best-effort), the chunked `sourceUrl in`
 * lookups over the Central and the best-effort revalidation of the public
 * Central after a direct-DB write. The planning/reporting stays pure in
 * `instagramContentPlan.mjs`; the token never leaves this module.
 */

import { REVALIDATE_CONTENT_PIECES_TAG } from '../../src/utilities/revalidateRequest.ts'
import {
  isInstagramFeedConfigured,
  loadInstagramFeed,
  persistInstagramAccessToken,
} from '../../src/utilities/socialFeed/instagramFeed.ts'

/** A hung Graph API must not hold the run forever. */
const INSTAGRAM_CONTENT_FEED_TIMEOUT_MS = 60_000

/**
 * The edge serves up to 10K media; the date early-stop bounds the walk, so the
 * cap is the platform's own ceiling — a deep window is never silently cut at
 * an arbitrary page count.
 */
const INSTAGRAM_CONTENT_FEED_MAX_RESULTS = 10_000

/**
 * Chunk of one `sourceUrl in` lookup: a deep window (up to 10K media × 3 URL
 * spellings) would blow the query/payload size in a single `in`.
 */
const CONTENT_PIECE_SOURCE_URL_CHUNK = 2_000

/**
 * Reads the own-profile feed window with the global's credential, fail-closed:
 * an unconfigured credential never reaches the API, and a feed failure is told
 * apart from the missing credential so each CLI prints its own honest message.
 * A refreshed token is persisted best-effort, exactly like the link path.
 *
 * @param {{
 *   payload: import('payload').Payload,
 *   days: number,
 *   maxResults?: number,
 *   timeoutMs?: number,
 * }} input
 * @returns {Promise<
 *   | { feed: Awaited<ReturnType<typeof loadInstagramFeed>>, from: Date, to: Date }
 *   | { error: 'unavailable' | 'feed' }
 * >}
 */
export const loadInstagramContentWindowFeed = async ({
  payload,
  days,
  maxResults = INSTAGRAM_CONTENT_FEED_MAX_RESULTS,
  timeoutMs = INSTAGRAM_CONTENT_FEED_TIMEOUT_MS,
}) => {
  // Intentional admin bypass: the global is admin-only and its credential is
  // read solely to call the official API; the token never leaves this call.
  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  if (!isInstagramFeedConfigured(settings)) return { error: 'unavailable' }

  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  let feed
  try {
    feed = await loadInstagramFeed({
      accessToken: settings.instagramAccessToken,
      userId: settings.instagramUserId,
      maxResults,
      // The feed is newest-first: the first page carrying a post older than the
      // window ends the walk, so the typical run costs one page per 50 medias.
      shouldStopAt: (post) => {
        const timestamp = Date.parse(post.timestamp)
        return Number.isFinite(timestamp) && timestamp < from.getTime()
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return { error: 'feed' }
  }

  if (feed.refreshedAccessToken) {
    await persistInstagramAccessToken(payload, feed.refreshedAccessToken).catch(() => undefined)
  }
  return { feed, from, to }
}

/**
 * One chunked lookup of the Central by `sourceUrl`, with optional extra `and`
 * conditions (status/processing filters). `select` keeps the rows lean.
 *
 * @param {{
 *   payload: import('payload').Payload,
 *   sourceUrls: readonly string[],
 *   where?: readonly Record<string, unknown>[],
 *   select: Record<string, true>,
 * }} input
 */
export const findContentPieceSourceRows = async ({ payload, sourceUrls, where = [], select }) => {
  const unique = [...new Set(sourceUrls)]
  const docs = []

  for (let index = 0; index < unique.length; index += CONTENT_PIECE_SOURCE_URL_CHUNK) {
    const chunk = unique.slice(index, index + CONTENT_PIECE_SOURCE_URL_CHUNK)
    const found = await payload.find({
      collection: 'contentPiece',
      where: { and: [{ sourceUrl: { in: chunk } }, ...where] },
      depth: 0,
      limit: 0,
      pagination: false,
      select,
      // Intentional admin bypass: the ops run must see every catalogue row,
      // including drafts no actor could read.
      overrideAccess: true,
    })
    docs.push(...found.docs)
  }
  return docs
}

/**
 * The CLIs write straight to the DB, so the collection hook's `revalidateTag`
 * is a no-op in their process (the seed loader stubs `next/cache`): the public
 * Central is busted over HTTP, best-effort — a failure never fails the run and
 * is named in the receipt. Uses the same tag the hook busts.
 *
 * @returns {Promise<{ attempted: boolean, ok: boolean, reason: string | null }>}
 */
export const revalidateInstagramContentCentral = async () => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  const secret = process.env.REVALIDATE_SECRET?.trim()
  if (!baseUrl || !secret) {
    return { attempted: true, ok: false, reason: 'NEXT_PUBLIC_SITE_URL/REVALIDATE_SECRET ausentes' }
  }
  try {
    const response = await fetch(
      `${baseUrl}/api/revalidate?tag=${encodeURIComponent(REVALIDATE_CONTENT_PIECES_TAG)}`,
      {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
        signal: AbortSignal.timeout(15_000),
      },
    )
    return response.ok
      ? { attempted: true, ok: true, reason: null }
      : { attempted: true, ok: false, reason: `HTTP ${response.status}` }
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      reason: error instanceof Error && error.message !== '' ? error.message : 'falha de rede',
    }
  }
}
