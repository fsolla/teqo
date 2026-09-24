import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'
import { loadPrivateMediaForActor } from '@/utilities/privateMedia/privateMediaGate'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C216 — the authenticated cover of one web speech. The thumbnail lives in the
 * private `internetSpeechMedia` collection, so it can never go through the
 * public `/api/media/file` proxy; the gate is the shared
 * `loadPrivateMediaForActor` and a row without a captured thumbnail answers
 * `404` and the list renders its neutral placeholder.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL },
  })

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await params
  const payload = await getPayload({ config })
  const found = await loadPrivateMediaForActor({
    payload,
    collection: 'speech',
    id: Number(id),
    select: { origin: true, thumbnail: true },
    isServable: (speech) => speech.origin === 'web',
    artifactOf: (speech) => speech.thumbnail,
  })
  if (!found) return notFound()

  return buildPrivateMediaResponse({
    media: found.media,
    staticDir: resolvePrivateMediaStaticDir(payload, INTERNET_SPEECH_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: false,
  })
}
