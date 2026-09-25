import 'server-only'

import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import {
  CONTENT_MEDIA_SLUG,
  CONTENT_PIECE_MAX_BYTES,
  parseContentPieceLink,
  type ContentPieceLinkFailureReason,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  isInstagramFeedConfigured,
  loadInstagramFeed,
  persistInstagramAccessToken,
} from '@/utilities/socialFeed/instagramFeed'

/**
 * C211/C220 — the official-path resolution of a piece that entered by link.
 * There is NO scraping and no oEmbed: the only extraction route is the
 * Instagram Graph API of the campaign's OWN account (listing the profile media
 * and matching the pasted shortcode), exactly what the gate decided. YouTube
 * exposes only metadata through the Data API, so a YouTube piece always
 * circulates by link and carries NO failure reason.
 *
 * Every Instagram-side failure returns a `linkFailureReason` instead of
 * throwing: the piece becomes a peça-link (`pronto`) with an honest reason on
 * the ficha — never silence, never "Falhou". Only failures the pipeline itself
 * can retry or the assessoria can solve by attaching the file (the 4 GB
 * ceiling, storage, ffmpeg) still throw.
 */

export type ContentPieceSourceMedia = {
  id: number
  filename?: string | null
  filesize?: number | null
  mimeType?: string | null
}

export type ContentPieceSourceResolution = {
  /** The archived media (existing or newly extracted); null for a peça-link. */
  media: ContentPieceSourceMedia | null
  /** Local temp copy of an extracted file (the job's ffmpeg input). */
  localPath: string | null
  /** Official caption of the matched post; null when there was no match. */
  caption: string | null
  /** The type the official media reveals (an Instagram image is a photo). */
  suggestedType?: ContentPieceType
  /** C220 — why the piece stayed a peça-link; null when there is nothing to explain. */
  linkFailureReason: ContentPieceLinkFailureReason | null
}

type FeedLoader = typeof loadInstagramFeed

/**
 * C220 — how far back the pasted post is searched in the official profile:
 * 10 pages of 50, with an early stop on the match. The typical paste is the
 * post that just went out (one page); the declared window covers ~1–2 years
 * and stays well under the API edge's 10K budget (C212 §Q1). A post beyond it
 * gets the honest `nao-encontrado` reason.
 */
export const CONTENT_PIECE_LINK_INSTAGRAM_WINDOW = 500

/**
 * The identity of a Graph API post for the pasted link: the shortcode (the
 * kind is presentation, so a `/p/ABC/` paste matches a reel's permalink too).
 * The same predicate drives the pagination early stop and the final match, so
 * the walk never continues past the answer.
 */
const matchesInstagramShortcode =
  (shortcode: string) =>
  (post: { permalink: string }): boolean => {
    const parsed = parseContentPieceLink(post.permalink)
    return parsed?.origin === 'instagram' && parsed.shortcode === shortcode
  }

/** A hung Graph API must not hold the piece `processando` until the 1 h reaper. */
const CONTENT_PIECE_LINK_FEED_TIMEOUT_MS = 30_000

/** Same deadline for the media CDN (the speech pipeline precedent is 180 s). */
const CONTENT_PIECE_LINK_DOWNLOAD_TIMEOUT_MS = 3 * 60_000

/**
 * Our own ceiling, not the platform's: it must stay distinguishable from a
 * transport failure so the resolver rethrows it (`falhou`) instead of dressing
 * a policy refusal as "Instagram indisponível".
 */
export class ContentPieceMediaTooLargeError extends Error {
  constructor() {
    super('A mídia extraída excede o limite da Central.')
    this.name = 'ContentPieceMediaTooLargeError'
  }
}

const streamResponseToFile = async ({
  response,
  destination,
  maxBytes,
}: {
  response: Response
  destination: string
  maxBytes: number
}): Promise<void> => {
  if (!response.body) throw new Error('A mídia extraída não trouxe arquivo.')
  let received = 0
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        callback(new ContentPieceMediaTooLargeError())
        return
      }
      callback(null, chunk)
    },
  })
  await pipeline(
    Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
    guard,
    createWriteStream(destination),
  )
}

/**
 * Resolves the source of one piece: the archived media when it exists,
 * otherwise the official extraction for an Instagram link, otherwise nothing
 * (peça-link). Injectable deps keep the int test free of network calls. Every
 * Instagram-side miss carries a `linkFailureReason` for the ficha.
 */
export const resolveContentPieceSource = async ({
  payload,
  piece,
  tempDir,
  loadFeed = loadInstagramFeed,
  fetchImpl = fetch,
}: {
  payload: Payload
  piece: {
    id: number
    title: string
    origin: string
    sourceUrl?: string | null
    media?: number | ContentPieceSourceMedia | null
  }
  tempDir: string
  loadFeed?: FeedLoader
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
}): Promise<ContentPieceSourceResolution> => {
  /** A peça-link answer: no media, optional official caption, honest reason. */
  const linkOnly = (
    linkFailureReason: ContentPieceLinkFailureReason,
    caption: string | null = null,
  ): ContentPieceSourceResolution => ({
    media: null,
    localPath: null,
    caption,
    linkFailureReason,
  })

  if (piece.media && typeof piece.media === 'object') {
    return { media: piece.media, localPath: null, caption: null, linkFailureReason: null }
  }
  if (piece.media) {
    // A bare id (depth 0) is not a file the pipeline can read; fail closed to
    // the link resolution instead of handing a number to the downloader.
    return { media: null, localPath: null, caption: null, linkFailureReason: null }
  }
  if (piece.origin !== 'instagram' || !piece.sourceUrl) {
    // YouTube (link-only by design) and uploaded files have nothing to explain.
    return { media: null, localPath: null, caption: null, linkFailureReason: null }
  }

  const link = parseContentPieceLink(piece.sourceUrl)
  if (!link || link.origin !== 'instagram') {
    return { media: null, localPath: null, caption: null, linkFailureReason: null }
  }

  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  if (!isInstagramFeedConfigured(settings)) {
    return linkOnly('sem-credencial')
  }

  let feed: Awaited<ReturnType<FeedLoader>>
  try {
    feed = await loadFeed({
      accessToken: settings.instagramAccessToken as string,
      userId: settings.instagramUserId as string,
      maxResults: CONTENT_PIECE_LINK_INSTAGRAM_WINDOW,
      // Early stop: the page that carries the pasted post ends the walk, so the
      // typical paste costs ONE call and a failing deeper cursor can never turn
      // a page-1 match into `indisponivel`.
      shouldStopAt: matchesInstagramShortcode(link.shortcode),
      fetchImpl,
      signal: AbortSignal.timeout(CONTENT_PIECE_LINK_FEED_TIMEOUT_MS),
    })
  } catch {
    // Token expired, API down: the piece becomes a peça-link with the honest
    // reason, never an error in the assessoria's face.
    return linkOnly('indisponivel')
  }

  if (feed.refreshedAccessToken) {
    // Best-effort: storing the refreshed token never fails the extraction, and
    // the token itself is never logged.
    await persistInstagramAccessToken(payload, feed.refreshedAccessToken).catch(() => undefined)
  }

  // The shortcode is the identity; the kind (`p` × `reel`) is presentation, so
  // a `/p/ABC/` paste matches a reel's permalink too. Matching inside the OWN
  // profile feed is also what guarantees a third-party link never downloads.
  const matched = feed.posts.find(matchesInstagramShortcode(link.shortcode))
  if (!matched) {
    return linkOnly('nao-encontrado')
  }

  if (matched.mediaType === 'CAROUSEL_ALBUM') {
    return linkOnly('carrossel', matched.caption)
  }

  const extractable =
    matched.mediaType === 'IMAGE' || matched.mediaType === 'VIDEO' || matched.mediaType === 'REEL'
  if (!extractable || !matched.mediaUrl) {
    // The API found the post but has no single file to hand over.
    return linkOnly('indisponivel', matched.caption)
  }

  let response: Response
  try {
    response = await fetchImpl(matched.mediaUrl, {
      signal: AbortSignal.timeout(CONTENT_PIECE_LINK_DOWNLOAD_TIMEOUT_MS),
    })
  } catch {
    return linkOnly('indisponivel', matched.caption)
  }
  if (!response.ok) {
    return linkOnly('indisponivel', matched.caption)
  }

  const suggestedType: ContentPieceType = matched.mediaType === 'IMAGE' ? 'foto' : 'video'
  const extension = suggestedType === 'foto' ? 'jpg' : 'mp4'
  const localPath = `${tempDir}/instagram-${link.shortcode}.${extension}`
  try {
    await streamResponseToFile({
      response,
      destination: localPath,
      maxBytes: CONTENT_PIECE_MAX_BYTES,
    })
  } catch (error) {
    // Our ceiling is not the platform's: it stays a failure the assessoria
    // solves by attaching the file. Any other stream error is transport.
    if (error instanceof ContentPieceMediaTooLargeError) throw error
    return linkOnly('indisponivel', matched.caption)
  }

  const media = await withPayloadTransaction(payload, async ({ req }) => {
    const created = await payload.create({
      collection: CONTENT_MEDIA_SLUG,
      data: { alt: piece.title },
      filePath: localPath,
      depth: 0,
      // Intentional admin bypass: the extraction runs in the pipeline, after
      // the response, and the piece was created behind the Central gate.
      overrideAccess: true,
      req,
    })
    await payload.update({
      collection: 'contentPiece',
      id: piece.id,
      data: { media: created.id },
      depth: 0,
      // Intentional admin bypass: the pipeline owns the row state.
      overrideAccess: true,
      req,
    })
    return created
  })

  return { media, localPath, caption: matched.caption, suggestedType, linkFailureReason: null }
}
