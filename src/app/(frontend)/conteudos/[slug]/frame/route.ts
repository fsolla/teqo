import config from '@payload-config'
import { after, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { CONTENT_MEDIA_SLUG } from '@/lib/contentPiece'
import { CONTENT_PIECE_FRAME_WAIT_MS } from '@/lib/contentPieceFrame'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import {
  ensureContentPieceFrame,
  findContentPieceFrameMedia,
} from '@/utilities/content/contentPieceFrameJob'
import { getPublishedContentPieceBySlug } from '@/utilities/content/contentPieceReads'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C226 — the still of a published video piece. Sibling of `/midia` with the very
 * same gate: the cached public read (published + archived file), so a draft, an
 * unpublished piece, an unknown slug, a link piece and a non-video piece all
 * answer the same silent 404. The frame therefore stops being visible exactly
 * when the video does — the kill switch survives by construction, because the
 * derived file lives in the PRIVATE `contentMedia`, never in the public `media`.
 *
 * On a miss the still is generated and awaited for a short budget; the work
 * keeps running after the response, so the archive published before this slice
 * heals one piece per view without any backfill. Nothing here records a
 * circulation event: seeing a frame is not opening or downloading the piece.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL },
  })

/**
 * Resolves the promise, or null when the budget runs out first. A deliberate
 * twin of the C182 poster route's helper: the acervo route is behind the
 * campaign gate and must not be edited by this slice, and 15 lines of promise
 * racing is not worth a shared module for two call sites. Revisit if a third
 * door ever needs the same race.
 */
const settledWithin = async <Value>(
  promise: Promise<Value>,
  budgetMs: number,
): Promise<Value | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), budgetMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> => {
  const { slug } = await params
  const piece = await getPublishedContentPieceBySlug(slug)
  // `framePath` is the eligibility decision (a video with an archived file),
  // so a photo, an audio or a link piece never reaches the generation.
  if (!piece?.framePath) return notFound()

  const payload = await getPayload({ config })
  const generation = ensureContentPieceFrame(payload, piece.id)
  // The response below may answer the neutral slot before the still is ready;
  // `after` keeps the process alive until the generation settles (never a 524).
  after(async () => {
    await generation
  })

  const generated = await settledWithin(generation, CONTENT_PIECE_FRAME_WAIT_MS)
  // The probe after the wait closes the race with a generation that committed
  // its row while this request was waiting (the `Promise.race` resolves the
  // moment the budget is out, not the moment the row lands).
  const media = generated ?? (await findContentPieceFrameMedia(payload, piece.id).catch(() => null))
  if (!media?.filename) return notFound()

  // Intentional admin bypass: the public gate is the cached published read
  // above; the media row only supplies the stored object to stream.
  const response = await buildPrivateMediaResponse({
    media,
    staticDir: resolvePrivateMediaStaticDir(payload, CONTENT_MEDIA_SLUG),
    rangeHeader: null,
    download: false,
  })
  return response.status === 200 ? response : notFound()
}
