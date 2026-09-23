import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { CONTENT_MEDIA_SLUG } from '@/lib/contentPiece'
import { contentPieceDownloadFilename } from '@/lib/contentPieceCatalog'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { getPublishedContentPieceBySlug } from '@/utilities/content/contentPieceReads'
import {
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * S27 — the only public door to a published piece's archived file. The gate is
 * the cached public read (published + file/link predicate), so a draft, an
 * unpublished piece, an unknown slug and a link piece without an attachment
 * all answer the same silent 404 — the route never leaks which pieces exist.
 * The object itself stays in the private bucket; this reuses the C193/C199
 * streaming helper (range, disposition, private headers), never a second copy.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL },
  })

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> => {
  const { slug } = await params
  const piece = await getPublishedContentPieceBySlug(slug)
  if (!piece?.file) return notFound()

  const payload = await getPayload({ config })
  // Intentional admin bypass: the public gate is the cached published read
  // above; the media row only supplies the fresh filename/mimeType to stream.
  const media = await payload
    .findByID({
      collection: CONTENT_MEDIA_SLUG,
      id: piece.file.id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (!media?.filename) return notFound()

  return buildPrivateMediaResponse({
    media,
    staticDir: resolvePrivateMediaStaticDir(payload, CONTENT_MEDIA_SLUG),
    rangeHeader: request.headers.get('range'),
    download: new URL(request.url).searchParams.get('download') === '1',
    // The voter downloads `jorge-solla-1313-<slug>.<ext>`, never the internal
    // upload name; the object key stays `media.filename`.
    dispositionFilename: contentPieceDownloadFilename(slug, media.filename),
  })
}
