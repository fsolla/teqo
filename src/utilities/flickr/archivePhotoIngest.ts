import 'server-only'

import type { Payload } from 'payload'

import { ARCHIVE_PHOTO_SLUG, archivePhotoAlt, type ArchivePhotoImport } from '@/lib/archivePhoto'
import type { ArchivePhoto } from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C231 — Payload-side ingestion of one Flickr archive photo: the re-check by
 * `flickrId`, the transactional upload of the original and the row, and the
 * honest result the CLI turns into the receipt. The network side (listing,
 * metadata, download) belongs to `pnpm flickr:import`; nothing here touches
 * the Flickr API, publishes or curates.
 */

export type ArchivePhotoExisting = {
  id: number
  filename: string | null
  filesize: number | null
}

/**
 * The idempotency lookup: `flickrId` is the natural key. Used by the planner
 * (dry-run) AND by the ingestion itself, so a re-run never re-downloads what
 * is already archived. The documented CLI bypass applies (trusted actor with
 * no session).
 */
export const findArchivePhotoByFlickrId = async (
  payload: Payload,
  flickrId: string,
): Promise<ArchivePhotoExisting | null> => {
  const found = await payload.find({
    collection: ARCHIVE_PHOTO_SLUG,
    where: { flickrId: { equals: flickrId } },
    depth: 0,
    limit: 1,
    // Intentional bypass: the ingest CLI is a trusted actor with no session.
    overrideAccess: true,
  })
  const doc = found.docs[0]
  if (!doc) return null
  return { id: doc.id, filename: doc.filename ?? null, filesize: doc.filesize ?? null }
}

/**
 * The whole archive, read-only and paged (the `--verify` inventory source).
 * The same documented CLI bypass as the lookup applies (trusted actor).
 */
export const listArchivePhotos = async (payload: Payload): Promise<ArchivePhoto[]> => {
  const docs: ArchivePhoto[] = []
  let page = 1
  let totalPages = 1
  do {
    const found = await payload.find({
      collection: ARCHIVE_PHOTO_SLUG,
      page,
      limit: 100,
      depth: 0,
      sort: 'flickrId',
      // Intentional bypass: read-only inventory of the CLI's own collection.
      overrideAccess: true,
    })
    docs.push(...found.docs)
    totalPages = found.totalPages
    page += 1
  } while (page <= totalPages)
  return docs
}

export type ArchivePhotoIngestResult =
  | { status: 'created'; flickrId: string; id: number; filename: string | null }
  | { status: 'existing'; flickrId: string; id: number; filename: string | null }
  | { status: 'failed'; flickrId: string; stage: 'ingest'; error: string }

/**
 * Creates one archive row and uploads its original in ONE database
 * transaction (`req` threaded through the upload). The object write itself is
 * not part of the DB transaction: a rollback can leave an object behind, and
 * the deterministic storage name + `overwriteExistingFiles` self-heals it on
 * the next run. The existence re-check makes the write idempotent even if the
 * planner ran earlier. Every failure is returned, never thrown: the caller
 * owns the receipt.
 */
export const ingestArchivePhoto = async (
  payload: Payload,
  record: ArchivePhotoImport,
  { filePath }: { filePath: string },
): Promise<ArchivePhotoIngestResult> => {
  const existing = await findArchivePhotoByFlickrId(payload, record.flickrId)
  if (existing) {
    return {
      status: 'existing',
      flickrId: record.flickrId,
      id: existing.id,
      filename: existing.filename,
    }
  }

  try {
    const doc = await withPayloadTransaction(payload, async ({ req }) =>
      payload.create({
        collection: ARCHIVE_PHOTO_SLUG,
        data: {
          flickrId: record.flickrId,
          alt: archivePhotoAlt(record),
          title: record.title,
          description: record.description,
          tags: record.tags.map((name) => ({ name })),
          takenAt: record.takenAt,
          postedAt: record.postedAt,
          albums: record.albums,
          ...(record.geo ? { geo: record.geo } : {}),
          exif: record.exif,
          sourceUrl: record.sourceUrl,
          owner: record.owner,
          license: record.license,
        },
        filePath,
        req,
        overwriteExistingFiles: true,
        // Intentional bypass: the ingestion CLI is a trusted actor with no session.
        overrideAccess: true,
      }),
    )

    return {
      status: 'created',
      flickrId: record.flickrId,
      id: doc.id,
      filename: doc.filename ?? null,
    }
  } catch (error) {
    return {
      status: 'failed',
      flickrId: record.flickrId,
      stage: 'ingest',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
