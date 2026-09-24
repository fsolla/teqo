import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'
import { loadWebSpeechMediaForActor } from '@/utilities/speech/speechPageData'

export const dynamic = 'force-dynamic'

/**
 * C216 — the authenticated cover of one web speech. The thumbnail lives in the
 * private `internetSpeechMedia` collection, so it can never go through the
 * public `/api/media/file` proxy; a row without a captured thumbnail answers
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
  const user = await getCampaignUser()
  if (!user || !canReadCommunicationCatalog(user.role)) return notFound()

  const { id } = await params
  const speechId = Number(id)
  if (!Number.isInteger(speechId) || speechId <= 0) return notFound()

  const payload = await getPayload({ config })
  const found = await loadWebSpeechMediaForActor(payload, user, speechId, 'thumbnail')
  if (!found) return notFound()

  return buildPrivateMediaResponse({
    media: found.media,
    staticDir: resolvePrivateMediaStaticDir(payload, INTERNET_SPEECH_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: false,
  })
}
