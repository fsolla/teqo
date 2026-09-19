import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { canServeRecordingMedia, isRecordingStatus, RECORDING_MEDIA_SLUG } from '@/lib/recording'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { buildPrivateMediaResponse } from '@/utilities/privateMedia/privateMediaResponse'

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
  const user = await getCampaignUser()
  if (!user || !canReadCommunicationCatalog(user.role)) return notFound()

  const { id } = await params
  const recordingId = Number(id)
  if (!Number.isInteger(recordingId) || recordingId <= 0) return notFound()

  const payload = await getPayload({ config })
  const recording = await payload
    .findByID({
      collection: 'recording',
      id: recordingId,
      depth: 1,
      select: { status: true, media: true },
      user,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!recording || !isRecordingStatus(recording.status)) return notFound()
  if (!canServeRecordingMedia(recording.status)) return notFound()

  const media = recording.media
  if (!media || typeof media !== 'object') return notFound()

  const upload = payload.collections[RECORDING_MEDIA_SLUG].config.upload
  const staticDir =
    upload && typeof upload === 'object' && upload.staticDir
      ? upload.staticDir
      : RECORDING_MEDIA_SLUG

  return buildPrivateMediaResponse({
    media,
    staticDir,
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
  })
}
