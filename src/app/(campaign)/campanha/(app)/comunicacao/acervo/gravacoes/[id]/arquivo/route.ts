import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { canServeRecordingMedia, isRecordingStatus, RECORDING_MEDIA_SLUG } from '@/lib/recording'
import { loadPrivateMediaForActor } from '@/utilities/privateMedia/privateMediaGate'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C199 — the only door to a recording file. Lives under `/campanha` because the
 * `campaign-token` cookie is scoped to that path (a `<video>` sends the cookie,
 * never an Authorization header). The gate is the same communication catalog
 * predicate as the collection access; only a recording whose upload finished
 * serves its file, and every denial is a silent `404` so the route never leaks
 * which recordings exist.
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
    collection: 'recording',
    id: Number(id),
    select: { status: true, media: true },
    isServable: (recording) =>
      isRecordingStatus(recording.status) && canServeRecordingMedia(recording.status),
    artifactOf: (recording) => recording.media,
  })
  if (!found) return notFound()

  return buildPrivateMediaResponse({
    media: found.media,
    staticDir: resolvePrivateMediaStaticDir(payload, RECORDING_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
  })
}
