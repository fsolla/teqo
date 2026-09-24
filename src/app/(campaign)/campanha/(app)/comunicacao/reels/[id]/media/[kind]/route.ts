import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import {
  canServeReelMedia,
  isReelMediaKind,
  REEL_MEDIA_SLUG,
  reelMediaFieldByKind,
} from '@/lib/reel'
import { loadPrivateMediaForActor } from '@/utilities/privateMedia/privateMediaGate'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C193 — the only door to a reel file. Lives under `/campanha` because the
 * `campaign-token` cookie is scoped to that path (a `<video>`/`<img>` sends the
 * cookie, never an Authorization header). The gate is the shared
 * `loadPrivateMediaForActor` (same communication catalog predicate as the
 * collection access); only a `published` reel serves
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
  const { id, kind } = await params
  if (!isReelMediaKind(kind)) return notFound()

  const payload = await getPayload({ config })
  const found = await loadPrivateMediaForActor({
    payload,
    collection: 'reel',
    id: Number(id),
    isServable: (reel) => canServeReelMedia(reel.status),
    artifactOf: (reel) => reel[reelMediaFieldByKind[kind]],
  })
  if (!found) return notFound()

  return buildPrivateMediaResponse({
    media: found.media,
    staticDir: resolvePrivateMediaStaticDir(payload, REEL_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
  })
}
