import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import {
  canServeReelMedia,
  isReelMediaKind,
  REEL_MEDIA_SLUG,
  reelMediaFieldByKind,
} from '@/lib/reel'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { buildPrivateMediaResponse } from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C193 — the only door to a reel file. Lives under `/campanha` because the
 * `campaign-token` cookie is scoped to that path (a `<video>`/`<img>` sends the
 * cookie, never an Authorization header). The gate is the same communication
 * catalog predicate as the collection access; only a `published` reel serves
 * its files (the kill switch), and every denial is a silent `404` so the route
 * never leaks which reels exist.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL },
  })

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
): Promise<Response> => {
  const user = await getCampaignUser()
  if (!user || !canReadCommunicationCatalog(user.role)) return notFound()

  const { id, kind } = await params
  const reelId = Number(id)
  if (!Number.isInteger(reelId) || reelId <= 0 || !isReelMediaKind(kind)) return notFound()

  const payload = await getPayload({ config })
  const reel = await payload
    .findByID({
      collection: 'reel',
      id: reelId,
      depth: 1,
      user,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!reel || !canServeReelMedia(reel.status)) return notFound()

  const media = reel[reelMediaFieldByKind[kind]]
  if (!media || typeof media !== 'object') return notFound()

  const upload = payload.collections[REEL_MEDIA_SLUG].config.upload
  const staticDir =
    upload && typeof upload === 'object' && upload.staticDir ? upload.staticDir : REEL_MEDIA_SLUG

  return buildPrivateMediaResponse({
    media,
    staticDir,
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
  })
}
