import 'server-only'

import type { Payload } from 'payload'

import {
  contentPieceLinkTitle,
  contentPiecePostIdentityUrls,
  contentPieceProfileCandidateFromPost,
  parseContentPieceLink,
  type ContentPieceLink,
  type ContentPieceProfileCandidate,
} from '@/lib/contentPiece'
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

/** A hung Graph API must not hold the confirm dialog until the job reaper. */
const CONTENT_PIECE_PROFILE_IMPORT_FEED_TIMEOUT_MS = 30_000

type FeedLoader = typeof loadInstagramFeed
type FetchLike = (input: string, requestInit?: RequestInit) => Promise<Response>

export type ContentPieceProfileImportListing = {
  /** Media of the window the API answered with (parseable as profile posts). */
  found: number
  /** How many of them already have a piece in the Central, in ANY URL spelling. */
  existingCount: number
  /** The novelties, in feed order (newest first). */
  candidates: ContentPieceProfileCandidate[]
}

export type ContentPieceProfileImportOutcome = 'created' | 'existing'

const cataloguedSourceUrls = async ({
  payload,
  actor,
  identityUrls,
}: {
  payload: Payload
  actor: CampaignUser
  identityUrls: readonly string[]
}): Promise<Set<string>> => {
  if (identityUrls.length === 0) return new Set()

  const found = await payload.find({
    collection: 'contentPiece',
    where: { sourceUrl: { in: [...new Set(identityUrls)] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { sourceUrl: true },
    user: actor,
    overrideAccess: false,
  })

  return new Set(
    found.docs
      .map((doc) => doc.sourceUrl)
      .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl)),
  )
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
 */
const loadConfiguredInstagramFeed = async ({
  payload,
  loadFeed,
  fetchImpl,
}: {
  payload: Payload
  loadFeed: FeedLoader
  fetchImpl: FetchLike
}): Promise<Awaited<ReturnType<FeedLoader>>> => {
  // Intentional admin bypass: the global's read access is admin-only, and the
  // listing is already behind the communication gate; the token stays inside
  // this call and never reaches the wire or a log.
  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  if (!isInstagramFeedConfigured(settings)) {
    throw new Error(CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE)
  }

  let feed: Awaited<ReturnType<FeedLoader>>
  try {
    feed = await loadFeed({
      accessToken: settings.instagramAccessToken as string,
      userId: settings.instagramUserId as string,
      maxResults: CONTENT_PIECE_PROFILE_IMPORT_INSTAGRAM_WINDOW,
      fetchImpl,
      signal: AbortSignal.timeout(CONTENT_PIECE_PROFILE_IMPORT_FEED_TIMEOUT_MS),
    })
  } catch {
    // Token expired, API down: the operator reads the retry copy, never a
    // transport detail. The token itself is never part of the error.
    throw new Error(CONTENT_PIECE_PROFILE_IMPORT_FEED_ERROR_MESSAGE)
  }

  if (feed.refreshedAccessToken) {
    await persistInstagramAccessToken(payload, feed.refreshedAccessToken).catch(() => undefined)
  }
  return feed
}

/**
 * Lists the window's novelties, already deduplicated by post identity: `found`
 * is what the API answered with (parseable), `existingCount` what the Central
 * already had and `candidates` what the confirmation will create, newest
 * first.
 */
export const listContentPieceProfileImportCandidates = async ({
  payload,
  actor,
  loadFeed = loadInstagramFeed,
  fetchImpl = fetch,
}: {
  payload: Payload
  actor: CampaignUser
  loadFeed?: FeedLoader
  fetchImpl?: FetchLike
}): Promise<ContentPieceProfileImportListing> => {
  const feed = await loadConfiguredInstagramFeed({ payload, loadFeed, fetchImpl })

  const parsed: { link: ContentPieceLink; candidate: ContentPieceProfileCandidate }[] = []
  for (const post of feed.posts) {
    const candidate = contentPieceProfileCandidateFromPost(post)
    if (!candidate) continue
    const link = parseContentPieceLink(candidate.url)
    if (!link) continue
    parsed.push({ link, candidate })
  }

  const catalogued = await cataloguedSourceUrls({
    payload,
    actor,
    identityUrls: parsed.flatMap(({ link }) => contentPiecePostIdentityUrls(link)),
  })
  const candidates = parsed
    .filter(({ link }) =>
      contentPiecePostIdentityUrls(link).every((identityUrl) => !catalogued.has(identityUrl)),
    )
    .map(({ candidate }) => candidate)

  return {
    found: parsed.length,
    existingCount: parsed.length - candidates.length,
    candidates,
  }
}

/**
 * Creates one draft from one listed media, exactly in the paste path's shape:
 * the C220 job then resolves the official file (or leaves the honest
 * peça-link reason), transcribes and catalogues — the importer never
 * downloads anything itself. `existing` covers the race with another actor
 * (the identity probe lost) and the unique index is the last barrier.
 */
export const createContentPieceFromProfilePost = async ({
  payload,
  actor,
  url,
  startJob = startContentPieceJobInBackground,
}: {
  payload: Payload
  actor: CampaignUser
  url: string
  startJob?: (contentPieceId: number) => void
}): Promise<ContentPieceProfileImportOutcome> => {
  const link = parseContentPieceLink(url)
  if (!link || link.origin !== 'instagram') {
    throw new Error(CONTENT_PIECE_LINK_INVALID_MESSAGE)
  }

  if (await contentPieceExistsForPostIdentity({ payload, actor, link })) return 'existing'

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
      user: actor,
      overrideAccess: false,
    })
    startJob(piece.id)
    return 'created'
  } catch (error) {
    // A concurrent import can still hit the unique index; it is the same
    // duplicate the identity probe answers.
    if (isContentPieceSourceUrlDuplicateError(error)) return 'existing'
    throw error
  }
}
