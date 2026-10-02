import 'server-only'

import type { Payload } from 'payload'

import {
  ARCHIVE_PHOTO_SLUG,
  archivePhotoAlt,
  type ArchivePhotoExifEntry,
  type ArchivePhotoImport,
} from '@/lib/archivePhoto'
import type { ArchivePhoto } from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C231 — Payload-side ingestion of one Flickr archive photo: the re-check by
 * `flickrId`, the transactional upload of the original and the row, and the
 * honest result the CLI turns into the receipt. The network side (listing,
 * metadata, download) belongs to `pnpm flickr:import`; nothing here touches
 * the Flickr API or curates.
 *
 * C246 adds the maintenance writes of the integrity sweep: the object replace
 * of one existing row (`repairArchivePhotoObject` — same key, no field edits)
 * and the unrecoverable exit from the public (`withdrawArchivePhotoFromPublic`
 * — `approved → draft`; `removed` stays untouched). Both are trusted-actor
 * writes with no session, like the ingestion.
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
          // C233 — ingestion only ever creates drafts; the album publishes
          // exclusively through a human curation edit.
          publicationStatus: 'draft',
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

export type ArchivePhotoExifUpdateResult =
  | { status: 'updated'; flickrId: string; id: number; entries: number }
  | { status: 'failed'; flickrId: string; error: string }

/**
 * C231 — rewrites ONLY the stored `exif` of one existing row: the
 * `--refresh-metadata` backfill for rows ingested before the mapper understood
 * the API's `{ _content }` leaves. The Flickr answer is the source of truth (an
 * empty answer clears the field), the deterministic order of
 * `archivePhotoExifEntries` makes an unchanged row comparable by the caller,
 * and every failure is returned, never thrown — the caller owns the receipt.
 * Same documented CLI bypass as the ingestion (trusted actor, no session).
 */
export const updateArchivePhotoExif = async (
  payload: Payload,
  { id, flickrId, exif }: { id: number; flickrId: string; exif: ArchivePhotoExifEntry[] },
): Promise<ArchivePhotoExifUpdateResult> => {
  try {
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { exif },
      // Intentional bypass: the maintenance CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    return { status: 'updated', flickrId, id, entries: exif.length }
  } catch (error) {
    return {
      status: 'failed',
      flickrId,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export type ArchivePhotoRepairResult =
  | { status: 'repaired'; id: number; filename: string | null; filesize: number | null }
  | { status: 'failed'; id: number; error: string }

/**
 * C246 — replaces the STORED OBJECT of one existing row with the file at
 * `filePath`, through the collection's own upload write path (`payload.update` +
 * `filePath` + `overwriteExistingFiles`). The update carries NO data fields: the
 * curation, the metadata and the `publicationStatus` are never touched; with the
 * caller naming the temp file after `row.filename`, the stored key does not
 * change and an `approved` photo returns to serving on the next request. Every
 * failure is returned, never thrown — the caller owns the receipt.
 * Same documented CLI bypass as the ingestion (trusted actor, no session).
 */
export const repairArchivePhotoObject = async (
  payload: Payload,
  { id, filePath }: { id: number; filePath: string },
): Promise<ArchivePhotoRepairResult> => {
  try {
    const doc = await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: {},
      filePath,
      overwriteExistingFiles: true,
      // Intentional bypass: the integrity CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    return {
      status: 'repaired',
      id,
      filename: doc.filename ?? null,
      filesize: doc.filesize ?? null,
    }
  } catch (error) {
    return { status: 'failed', id, error: error instanceof Error ? error.message : String(error) }
  }
}

export type ArchivePhotoWithdrawalResult =
  | { status: 'withdrawn'; id: number; flickrId: string; previousStatus: string }
  | { status: 'skipped'; id: number; flickrId: string; reason: 'removed' | 'already-draft' }
  | { status: 'failed'; id: number; flickrId: string; error: string }

/**
 * C246 — takes one unrecoverable photo out of the public: `approved → draft`
 * (the intent recommendation; `removed` is a takedown request from a person and
 * stays untouched). The removal-channel guard only covers the transition INTO
 * `approved`, so the downgrade never needs the channel; the collection hooks
 * purge the face descriptors and revalidate the public listing on the way out.
 * Every failure is returned, never thrown — the caller owns the receipt.
 */
export const withdrawArchivePhotoFromPublic = async (
  payload: Payload,
  { id, flickrId }: { id: number; flickrId: string },
): Promise<ArchivePhotoWithdrawalResult> => {
  try {
    const row = await payload.findByID({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      depth: 0,
      // Intentional bypass: the integrity CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    const previousStatus = row.publicationStatus
    if (previousStatus === 'removed') {
      return { status: 'skipped', id, flickrId, reason: 'removed' }
    }
    if (previousStatus === 'draft') {
      return { status: 'skipped', id, flickrId, reason: 'already-draft' }
    }
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { publicationStatus: 'draft' },
      // Intentional bypass: same trusted actor.
      overrideAccess: true,
    })
    return { status: 'withdrawn', id, flickrId, previousStatus }
  } catch (error) {
    return {
      status: 'failed',
      id,
      flickrId,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
