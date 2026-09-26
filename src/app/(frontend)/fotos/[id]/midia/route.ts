import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { ARCHIVE_PHOTO_THUMB_WIDTH } from '@/lib/archivePhotoPublicCatalog'
import { PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { getApprovedArchivePhotoById } from '@/utilities/archivePhotos/archivePhotoReads'
import {
  buildPrivateMediaImageResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C233 — the only public door to an approved photo. The gate is the cached
 * public read (`archivePhotoIsPublic`), so a draft, a removed photo, an unknown
 * id and a delete all answer the same silent 404 — the route never leaks which
 * photos exist. `?tamanho=grade` serves the on-the-fly resized thumbnail,
 * `?download=1` forces the legible `jorge-solla-1313-foto-<id>.<ext>` name; the
 * object itself stays in the private bucket (the C193/C199 streaming helper is
 * the single owner of that I/O). `X-Robots-Tag` keeps the derivative out of the
 * index: the canonical surface is the album, never the file.
 */

const notFound = (): NextResponse =>
  new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': PRIVATE_MEDIA_CACHE_CONTROL, 'X-Robots-Tag': 'noindex' },
  })

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await params
  if (!/^\d+$/.test(id)) return notFound()

  const photo = await getApprovedArchivePhotoById(Number(id))
  if (!photo) return notFound()

  const payload = await getPayload({ config })
  // Intentional admin bypass: the public gate is the cached approved read
  // above; the media row only supplies the fresh filename/mimeType to stream.
  const media = await payload
    .findByID({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (!media?.filename) return notFound()

  const searchParams = new URL(request.url).searchParams
  const thumbnail = searchParams.get('tamanho') === 'grade'
  const download = searchParams.get('download') === '1'

  const response = await buildPrivateMediaImageResponse({
    media,
    staticDir: resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG),
    width: thumbnail ? ARCHIVE_PHOTO_THUMB_WIDTH : null,
    download,
    dispositionFilename: photo.downloadFilename,
    // A resized derivative is generated whole; only the stored original honors
    // range requests (resumed transfer).
    rangeHeader: thumbnail ? null : request.headers.get('range'),
  })

  response.headers.set('X-Robots-Tag', 'noindex')
  return response
}
