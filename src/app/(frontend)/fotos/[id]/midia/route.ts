import config from '@payload-config'
import { after, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { ARCHIVE_PHOTO_THUMB_WIDTH } from '@/lib/archivePhotoPublicCatalog'
import {
  ARCHIVE_PHOTO_GRADE_MIME_TYPE,
  archivePhotoGradeFilename,
} from '@/lib/archivePhotoThumbnail'
import { acceptsAvif, PRIVATE_MEDIA_CACHE_CONTROL } from '@/lib/privateMedia'
import { getApprovedArchivePhotoById } from '@/utilities/archivePhotos/archivePhotoReads'
import { ensureArchivePhotoGrade } from '@/utilities/archivePhotos/archivePhotoThumbnails'
import {
  buildPrivateMediaImageResponse,
  buildPrivateMediaResponse,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

export const dynamic = 'force-dynamic'

/**
 * C233 — the only public door to an approved photo. The gate is the cached
 * public read (`archivePhotoIsPublic`), so a draft, a removed photo, an unknown
 * id and a delete all answer the same silent 404 — the route never leaks which
 * photos exist. `?tamanho=grade` serves the grade thumbnail, `?download=1`
 * forces the legible `jorge-solla-1313-foto-<id>.<ext>` name; the object itself
 * stays in the private bucket (the C193/C199 streaming helper is the single
 * owner of that I/O). `X-Robots-Tag` keeps the derivative out of the index: the
 * canonical surface is the album, never the file.
 *
 * C248 — when the client accepts AVIF and the stored grade exists, the grade
 * object is served directly (no sharp on the request); on a miss or any read
 * failure the route answers the on-the-fly JPEG exactly as before and heals
 * the grade for the next request in `after()`. `Vary: Accept` keeps a heuristic
 * cache from mixing the two representations even though the response is
 * `no-store`.
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
  const originalFilename = media.filename

  const searchParams = new URL(request.url).searchParams
  const thumbnail = searchParams.get('tamanho') === 'grade'
  const download = searchParams.get('download') === '1'

  const staticDir = resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)

  if (thumbnail && !download && acceptsAvif(request.headers.get('accept'))) {
    // The stored grade is a sibling object in the same private store; the
    // streaming owner answers 404/416 without leaking which object is there.
    const grade = await buildPrivateMediaResponse({
      media: {
        filename: archivePhotoGradeFilename(originalFilename),
        mimeType: ARCHIVE_PHOTO_GRADE_MIME_TYPE,
      },
      staticDir,
      rangeHeader: null,
      download: false,
      dispositionFilename: photo.downloadFilename,
    }).catch(() => null)

    if (grade?.status === 200) {
      grade.headers.set('X-Robots-Tag', 'noindex')
      grade.headers.set('Vary', 'Accept')
      return grade
    }

    // Missing/unreadable grade: rebuild it out of this latency window; the
    // fallback below answers this request exactly as the pre-C248 route did.
    after(() => ensureArchivePhotoGrade(payload, { filename: originalFilename }))
  }

  const response = await buildPrivateMediaImageResponse({
    media,
    staticDir,
    width: thumbnail ? ARCHIVE_PHOTO_THUMB_WIDTH : null,
    download,
    dispositionFilename: photo.downloadFilename,
    // A resized derivative is generated whole; only the stored original honors
    // range requests (resumed transfer).
    rangeHeader: thumbnail ? null : request.headers.get('range'),
  })

  response.headers.set('X-Robots-Tag', 'noindex')
  if (thumbnail && !download) response.headers.set('Vary', 'Accept')
  return response
}
