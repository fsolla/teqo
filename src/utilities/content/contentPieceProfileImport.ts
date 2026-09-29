import 'server-only'

import type { Payload } from 'payload'

import { formatBahiaCivilDate } from '@/lib/campaignTime'
import {
  contentPieceLinkTitle,
  parseContentPieceLink,
  type ContentPieceProfileCandidate,
} from '@/lib/contentPiece'
import {
  contentPieceProfileFeedIdentityUrls,
  contentPieceProfilePeriodBounds,
  contentPieceProfilePeriodError,
  contentPieceProfileWindowStartReached,
  planContentPieceProfileWindow,
  type ContentPieceProfileWindow,
} from '@/lib/contentPieceProfileWindow'
import {
  CONTENT_PIECE_LINK_INVALID_MESSAGE,
  CONTENT_PIECE_PROFILE_IMPORT_FEED_ERROR_MESSAGE,
  CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE,
} from '@/lib/schemas/contentPiece'
import type { CampaignUser } from '@/payload-types'
import {
  contentPieceExistsForPostIdentity,
  isContentPieceSourceUrlDuplicateError,
} from '@/utilities/content/contentPieceLink'
import { startContentPieceJobInBackground } from '@/utilities/content/contentPieceScheduler'
import {
  isInstagramFeedConfigured,
  loadInstagramFeed,
  persistInstagramAccessToken,
} from '@/utilities/socialFeed/instagramFeed'

/**
 * C230 — the profile importer: reads the recent media of the campaign's OWN
 * Instagram profile through the official Graph API client (no scraping, no
 * third-party media) and turns each novelty into a draft through the C211/C220
 * pipeline. The identity of a post is its shortcode, so the dedupe probe
 * matches the piece in any URL spelling — and the paste path (C220) shares the
 * same probe, so a post never gets a twin.
 */

/** The recency window of one import (12 media ≈ the profile's last days). */
export const CONTENT_PIECE_PROFILE_IMPORT_INSTAGRAM_WINDOW = 12

/**
 * C235 — the scan ceiling of one period import: the official edge itself only
 * answers the 10K most recently created media, so this is the real limit of
 * the walk, not a product cap.
 */
export const CONTENT_PIECE_PROFILE_IMPORT_SCAN_LIMIT = 10_000

/** A hung Graph API must not hold the confirm dialog until the job reaper. */
const CONTENT_PIECE_PROFILE_IMPORT_FEED_TIMEOUT_MS = 30_000

/** A period walk can cost many pages; the honest ceiling is still the edge. */
const CONTENT_PIECE_PROFILE_IMPORT_PERIOD_FEED_TIMEOUT_MS = 120_000

/**
 * The catalogue identity lookup asks `sourceUrl in (...)`; a 10K-media window
 * spells up to 30K URLs, so the probe runs in bounded chunks instead of one
 * oversized statement.
 */
const CONTENT_PIECE_PROFILE_IMPORT_IDENTITY_LOOKUP_CHUNK = 2_000

type FeedLoader = typeof loadInstagramFeed
type FetchLike = (input: string, requestInit?: RequestInit) => Promise<Response>

export type ContentPieceProfileImportListing = {
  /** Media of the window the API answered with (parseable as profile posts). */
  found: number
  /** How many of them already have a piece in the Central, in ANY URL spelling. */
  existingCount: number
  /** The novelties, in feed order (newest first). */
  candidates: ContentPieceProfileCandidate[]
  /**
   * True when the official API did not reach the start of the requested window
   * (edge limit, page ceiling or end of pagination): the receipt says the
   * window was not fully covered. Always false for the recency window.
   */
  truncated: boolean
}

export type ContentPieceProfileImportOutcome = 'created' | 'existing'

export type ContentPieceProfileImportCreation = {
  outcome: ContentPieceProfileImportOutcome
  /** The created row; null when the identity already existed (no new piece). */
  contentPieceId: number | null
}

const cataloguedSourceUrls = async ({
  payload,
  actor,
  identityUrls,
}: {
  payload: Payload
  actor: CampaignUser
  identityUrls: readonly string[]
}): Promise<Set<string>> => {
  const unique = [...new Set(identityUrls)]
  const catalogued = new Set<string>()

  for (
    let index = 0;
    index < unique.length;
    index += CONTENT_PIECE_PROFILE_IMPORT_IDENTITY_LOOKUP_CHUNK
  ) {
    const chunk = unique.slice(index, index + CONTENT_PIECE_PROFILE_IMPORT_IDENTITY_LOOKUP_CHUNK)
    const found = await payload.find({
      collection: 'contentPiece',
      where: { sourceUrl: { in: chunk } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { sourceUrl: true },
      user: actor,
      overrideAccess: false,
    })
    for (const doc of found.docs) {
      if (typeof doc.sourceUrl === 'string' && doc.sourceUrl) catalogued.add(doc.sourceUrl)
    }
  }

  return catalogued
}

/** True when the official credential is armed — what arms the import button. */
export const readContentPieceProfileImportAvailability = async (
  payload: Payload,
): Promise<boolean> => {
  // Intentional admin bypass: only the derived boolean crosses to the page;
  // the credential itself never leaves this module (same as the link path).
  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  return isInstagramFeedConfigured(settings)
}

/**
 * Reads the own-profile feed with the global's credential, fail-closed: an
 * unconfigured credential never reaches the API, and a feed failure becomes
 * the honest product message instead of a raw transport error. A refreshed
 * token is persisted best-effort, exactly like the link path.
 *
 * C235 — the recency window keeps the C230 one-page read; a period window
 * scans cursor pages with a date early-stop (the feed is newest-first, so the
 * first post older than the requested start ends the walk) up to the edge's
 * own 10K-media limit, and denounces the bounds actually applied.
 */
const loadConfiguredInstagramFeed = async ({
  payload,
  loadFeed,
  fetchImpl,
  window,
  now,
}: {
  payload: Payload
  loadFeed: FeedLoader
  fetchImpl: FetchLike
  window: ContentPieceProfileWindow
  now: Date
}): Promise<{
  feed: Awaited<ReturnType<FeedLoader>>
  bounds: { fromIso: string; toIso: string | null } | null
}> => {
  // Intentional admin bypass: the global's read access is admin-only, and the
  // listing is already behind the communication gate; the token stays inside
  // this call and never reaches the wire or a log.
  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  if (!isInstagramFeedConfigured(settings)) {
    throw new Error(CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE)
  }

  if (window.mode === 'period') {
    const error = contentPieceProfilePeriodError({
      since: window.since,
      until: window.until ?? null,
      today: formatBahiaCivilDate(now),
    })
    if (error) throw new Error(error)
  }
  const bounds =
    window.mode === 'period'
      ? contentPieceProfilePeriodBounds({ since: window.since, until: window.until ?? null })
      : null
  const fromMs = bounds ? Date.parse(bounds.fromIso) : null

  let feed: Awaited<ReturnType<FeedLoader>>
  try {
    feed = await loadFeed({
      accessToken: settings.instagramAccessToken as string,
      userId: settings.instagramUserId as string,
      maxResults: bounds
        ? CONTENT_PIECE_PROFILE_IMPORT_SCAN_LIMIT
        : CONTENT_PIECE_PROFILE_IMPORT_INSTAGRAM_WINDOW,
      ...(fromMs !== null ? { shouldStopAt: (post) => Date.parse(post.timestamp) < fromMs } : {}),
      fetchImpl,
      signal: AbortSignal.timeout(
        bounds
          ? CONTENT_PIECE_PROFILE_IMPORT_PERIOD_FEED_TIMEOUT_MS
          : CONTENT_PIECE_PROFILE_IMPORT_FEED_TIMEOUT_MS,
      ),
    })
  } catch {
    // Token expired, API down: the operator reads the retry copy, never a
    // transport detail. The token itself is never part of the error.
    throw new Error(CONTENT_PIECE_PROFILE_IMPORT_FEED_ERROR_MESSAGE)
  }

  if (feed.refreshedAccessToken) {
    await persistInstagramAccessToken(payload, feed.refreshedAccessToken).catch(() => undefined)
  }
  return { feed, bounds }
}

/**
 * Lists the window's novelties, already deduplicated by post identity: `found`
 * is what the API answered with inside the window (parseable), `existingCount`
 * what the Central already had, `candidates` what the confirmation will
 * create, newest first, and `truncated` when the official API did not reach
 * the requested start.
 *
 * The recency mode is the C230 behavior untouched (12 media, one page); the
 * period mode is the C235 window — the planner is the same owner for both.
 */
export const listContentPieceProfileImportCandidates = async ({
  payload,
  actor,
  window = { mode: 'recent' },
  loadFeed = loadInstagramFeed,
  fetchImpl = fetch,
  now = new Date(),
}: {
  payload: Payload
  actor: CampaignUser
  window?: ContentPieceProfileWindow
  loadFeed?: FeedLoader
  fetchImpl?: FetchLike
  now?: Date
}): Promise<ContentPieceProfileImportListing> => {
  const { feed, bounds } = await loadConfiguredInstagramFeed({
    payload,
    loadFeed,
    fetchImpl,
    window,
    now,
  })

  const catalogued = await cataloguedSourceUrls({
    payload,
    actor,
    identityUrls: contentPieceProfileFeedIdentityUrls(feed.posts),
  })
  const plan = planContentPieceProfileWindow({
    posts: feed.posts,
    existingSourceUrls: [...catalogued],
    from: bounds?.fromIso ?? null,
    to: bounds?.toIso ?? null,
  })

  return {
    found: plan.found,
    existingCount: plan.existingCount,
    candidates: plan.candidates.map(({ url, linkOnlyReason }) => ({ url, linkOnlyReason })),
    truncated:
      feed.posts.length > 0 &&
      !contentPieceProfileWindowStartReached({
        posts: feed.posts,
        fromIso: bounds?.fromIso ?? null,
      }),
  }
}

/**
 * Creates one draft from one listed media, exactly in the paste path's shape:
 * the C220 job then resolves the official file (or leaves the honest
 * peça-link reason), transcribes and catalogues — the importer never
 * downloads anything itself. `existing` covers the race with another actor
 * (the identity probe lost) and the unique index is the last barrier.
 *
 * `actor: null` is the ops/system mode used by the content import CLI: the
 * same shape and probe, with the intentional admin bypass of the pipeline
 * (the caller runs the job inline instead of scheduling it after a response).
 */
export const createContentPieceFromProfilePost = async ({
  payload,
  actor,
  url,
  startJob = startContentPieceJobInBackground,
}: {
  payload: Payload
  actor: CampaignUser | null
  url: string
  startJob?: (contentPieceId: number) => void
}): Promise<ContentPieceProfileImportCreation> => {
  const link = parseContentPieceLink(url)
  if (!link || link.origin !== 'instagram') {
    throw new Error(CONTENT_PIECE_LINK_INVALID_MESSAGE)
  }

  if (await contentPieceExistsForPostIdentity({ payload, actor, link })) {
    return { outcome: 'existing', contentPieceId: null }
  }

  try {
    const piece = await payload.create({
      collection: 'contentPiece',
      data: {
        title: contentPieceLinkTitle(link),
        type: 'video',
        origin: link.origin,
        sourceUrl: link.canonicalUrl,
        status: 'rascunho',
        processingStatus: 'processando',
        step: 'extraindo',
      },
      depth: 0,
      // Intentional admin bypass only for the ops/system mode (`actor: null`);
      // every request path passes the acting campaign user.
      ...(actor ? { user: actor, overrideAccess: false } : { overrideAccess: true }),
    })
    startJob(piece.id)
    return { outcome: 'created', contentPieceId: piece.id }
  } catch (error) {
    // A concurrent import can still hit the unique index; it is the same
    // duplicate the identity probe answers.
    if (isContentPieceSourceUrlDuplicateError(error)) {
      return { outcome: 'existing', contentPieceId: null }
    }
    throw error
  }
}
