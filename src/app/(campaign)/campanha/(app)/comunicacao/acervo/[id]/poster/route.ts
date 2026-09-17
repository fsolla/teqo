import config from '@payload-config'
import { after, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadSpeechCatalog } from '@/lib/campaignRoles'
import { speechCoverUrl } from '@/lib/speechVod'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { ensureSpeechPoster, SPEECH_POSTER_WAIT_MS } from '@/utilities/speech/speechPosterJob'

export const dynamic = 'force-dynamic'

/**
 * C182 — the acervo list frame. The list thumbnail points here; it answers a
 * `302` to the generated file in `media` (served by the media proxy) or, when
 * the frame is not ready yet, to the YouTube cover of the session (or `404` for
 * the neutral slot). On a miss it starts the generation and waits a short
 * budget; the generation keeps running after the response, so a slow speech
 * heals on the next view. Internal route: never a public URL contract.
 */

const emptyResponse = (status: number): NextResponse =>
  new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * `Location` is emitted as received (relative media proxy path or absolute
 * cover) instead of resolving it against `request.url`: behind the tunnel the
 * request URL may carry the internal host, which must never reach the browser.
 */
const redirectTo = (location: string, cacheControl: string): NextResponse =>
  new NextResponse(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': cacheControl },
  })

/** Resolves the promise, or null when the budget runs out first. */
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
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const user = await getCampaignUser()
  if (!user || !canReadSpeechCatalog(user.role)) return emptyResponse(404)

  const { id } = await params
  const speechId = Number(id)
  if (!Number.isInteger(speechId) || speechId <= 0) return emptyResponse(404)

  const payload = await getPayload({ config })

  const generation = ensureSpeechPoster(payload, speechId)
  // The response below may return before the frame is ready; `after` keeps the
  // process alive until the generation settles (never a 524 from waiting).
  after(async () => {
    await generation
  })

  const poster = await settledWithin(generation, SPEECH_POSTER_WAIT_MS)
  if (poster?.url) return redirectTo(poster.url, 'private, max-age=86400')

  // Fallback: the session cover is honest about the missing frame; `no-store`
  // lets a later view pick the frame once the background generation cached it.
  const speech = await payload.find({
    collection: 'speech',
    where: { id: { equals: speechId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { youtubeUrl: true },
    user,
    overrideAccess: false,
  })
  const cover = speechCoverUrl(speech.docs[0]?.youtubeUrl)
  return cover ? redirectTo(cover, 'no-store') : emptyResponse(404)
}
