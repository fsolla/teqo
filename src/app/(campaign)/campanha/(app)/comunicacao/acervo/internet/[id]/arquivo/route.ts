import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { INTERNET_SPEECH_MEDIA_SLUG, webSpeechDownloadFilename } from '@/lib/webSpeech'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'
import { loadWebSpeechMediaForActor } from '@/utilities/speech/speechPageData'

export const dynamic = 'force-dynamic'

/**
 * C216 — the only door to a web speech's mirrored file. Lives under `/campanha`
 * because the `campaign-token` cookie is scoped to that path (a `<video>` sends
 * the cookie, never an Authorization header). The gate is the same
 * communication catalog predicate as the collection access; only web rows are
 * served and every denial is a silent `404` so the route never leaks which
 * speeches exist. The download name is derived from the speech title (C215 S4).
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
  const found = await loadWebSpeechMediaForActor(payload, user, speechId, 'mirroredMedia')
  if (!found) return notFound()

  return buildPrivateMediaResponse({
    media: found.media,
    staticDir: resolvePrivateMediaStaticDir(payload, INTERNET_SPEECH_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
    dispositionFilename: webSpeechDownloadFilename({
      title: found.title,
      storedFilename: found.media.filename,
    }),
  })
}
