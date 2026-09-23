import 'server-only'

import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Payload } from 'payload'

import {
  CONTENT_MEDIA_SLUG,
  CONTENT_PIECE_MAX_BYTES,
  parseContentPieceLink,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  INSTAGRAM_MAX_RESULTS_CAP,
  isInstagramFeedConfigured,
  loadInstagramFeed,
} from '@/utilities/socialFeed/instagramFeed'

/**
 * C211 — the official-path resolution of a piece that entered by link. There is
 * NO scraping and no oEmbed: the only extraction route is the Instagram Graph
 * API of the campaign's OWN account (listing the profile media and matching the
 * pasted permalink), exactly what the gate decided. YouTube exposes only
 * metadata through the Data API, so a YouTube piece always circulates by link.
 *
 * A failed extraction never throws at the caller: the piece becomes a
 * peça-link (the job still catalogues the official caption when there is one).
 * A download that starts and fails DOES throw — the row is preserved and the
 * assessoria can reprocess or attach the original file.
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
}

type FeedLoader = typeof loadInstagramFeed

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
        callback(new Error('A mídia extraída excede o limite da Central.'))
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
 * (peça-link). Injectable deps keep the int test free of network calls.
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
  if (piece.media && typeof piece.media === 'object') {
    return { media: piece.media, localPath: null, caption: null }
  }
  if (piece.media) {
    // A bare id (depth 0) is not a file the pipeline can read; fail closed to
    // the link resolution instead of handing a number to the downloader.
    return { media: null, localPath: null, caption: null }
  }
  if (piece.origin !== 'instagram' || !piece.sourceUrl) {
    return { media: null, localPath: null, caption: null }
  }

  const link = parseContentPieceLink(piece.sourceUrl)
  if (!link || link.origin !== 'instagram') {
    return { media: null, localPath: null, caption: null }
  }

  const settings = await payload.findGlobal({ slug: 'social-feed-settings', depth: 0 })
  if (!isInstagramFeedConfigured(settings)) {
    return { media: null, localPath: null, caption: null }
  }

  let feed: Awaited<ReturnType<FeedLoader>>
  try {
    feed = await loadFeed({
      accessToken: settings.instagramAccessToken as string,
      userId: settings.instagramUserId as string,
      maxResults: INSTAGRAM_MAX_RESULTS_CAP,
      fetchImpl,
    })
  } catch {
    // Token expired, API down: fail closed to the link piece, never to an error
    // in the assessoria's face.
    return { media: null, localPath: null, caption: null }
  }

  // Canonical URLs on both sides: the shortcode is the identity and the form is
  // the same, so two spellings of the same post always match.
  const matched = feed.posts.find(
    (post) => parseContentPieceLink(post.permalink)?.canonicalUrl === link.canonicalUrl,
  )
  if (!matched) return { media: null, localPath: null, caption: null }

  const extractable =
    matched.mediaType === 'IMAGE' || matched.mediaType === 'VIDEO' || matched.mediaType === 'REEL'
  if (!extractable || !matched.mediaUrl) {
    // Carousel (no single file) or a post without a media URL: the caption is
    // still official metadata the cataloguing can use.
    return { media: null, localPath: null, caption: matched.caption }
  }

  const response = await fetchImpl(matched.mediaUrl)
  if (!response.ok) throw new Error('Não foi possível baixar a mídia do Instagram.')

  const suggestedType: ContentPieceType = matched.mediaType === 'IMAGE' ? 'foto' : 'video'
  const extension = suggestedType === 'foto' ? 'jpg' : 'mp4'
  const localPath = `${tempDir}/instagram-${link.shortcode}.${extension}`
  await streamResponseToFile({
    response,
    destination: localPath,
    maxBytes: CONTENT_PIECE_MAX_BYTES,
  })

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

  return { media, localPath, caption: matched.caption, suggestedType }
}
