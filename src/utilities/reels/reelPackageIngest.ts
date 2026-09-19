import 'server-only'

import { readFile } from 'node:fs/promises'
import type { Payload } from 'payload'

import {
  reelArtifactAlt,
  reelArtifactMimetype,
  reelArtifactStorageFilename,
  type ReelMediaField,
  type ReelPackage,
  type ReelPackageArtifactEntry,
} from '@/lib/reel'
import type { Reel, ReelMedia } from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C195 — writes one validated reel package into the private library through the
 * Local API. Runs on the homeserver maintenance image (`pnpm reels:ingest`),
 * so it deliberately has no `user`: the CLI is an admin-level operation (same
 * precedent as `seed-minimal`/staging test account), `createdBy` stays null and
 * every database write shares one transaction — a failure never leaves a
 * partially visible reel. Upload bytes live outside the transaction;
 * deterministic object names make a re-run overwrite the same keys (an orphan
 * object after a rollback is accepted and self-heals on the next run).
 *
 * Idempotency: the `sourceHash` (shot list hash of the manifest) identifies the
 * reel. A package with a known hash updates that entry in place — the same
 * `reelMedia` documents, never duplicates — and preserves the current `status`,
 * so re-ingesting never resurrects an unpublished reel. A new hash publishes a
 * new entry.
 */

export type ReelIngestResult = {
  operation: 'created' | 'updated'
  reelId: number
}

type ReelWriteData = {
  title: string
  feature: Reel['feature']
  sourceHash: string
  video: number
  cover: number
  transcript?: string
} & Partial<Record<'videoWithAudio' | 'narrationAudio' | 'captions', number>>

const mediaIdOf = (value: Reel[ReelMediaField]): number | null => {
  if (value === null || value === undefined) return null
  return typeof value === 'number' ? value : value.id
}

/**
 * The reel registered by this package, or null when the hash is new. Reads
 * without a campaign user — the documented CLI admin bypass (same precedent as
 * seed-minimal/staging test account).
 */
export const findReelBySourceHash = async (
  payload: Payload,
  sourceHash: string,
): Promise<Reel | null> => {
  // Documented admin bypass: the CLI has no campaign user.
  const found = await payload.find({
    collection: 'reel',
    where: { sourceHash: { equals: sourceHash } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

const artifactUpload = async (artifact: ReelPackageArtifactEntry, shotListHash: string) => {
  const data = await readFile(artifact.path)
  return {
    data,
    mimetype: reelArtifactMimetype(artifact.kind),
    name: reelArtifactStorageFilename(shotListHash, artifact),
    size: data.length,
  }
}

/**
 * Creates or updates the reel of the package. Required artifacts are validated
 * by `readReelPackage` before this runs; optional artifacts absent from the
 * package leave the previous value untouched (a re-render without the draft
 * audio never silently erases it). The transcript follows the same rule.
 */
export const ingestReelPackage = async (
  payload: Payload,
  reelPackage: ReelPackage,
): Promise<ReelIngestResult> => {
  const { metadata, artifacts, transcriptPath } = reelPackage
  const transcript = transcriptPath === null ? null : await readFile(transcriptPath, 'utf8')
  const existing = await findReelBySourceHash(payload, metadata.shotListHash)

  return withPayloadTransaction(payload, async ({ req }) => {
    const mediaIds: Partial<Record<ReelMediaField, number>> = {}

    for (const artifact of artifacts) {
      if (!artifact.present) continue

      const alt = reelArtifactAlt({
        title: metadata.title,
        kind: artifact.kind,
        coverAlt: metadata.coverAlt,
      })
      const existingMediaId = existing === null ? null : mediaIdOf(existing[artifact.field])

      // No campaign user in the CLI: the documented admin bypass for reelMedia.
      let media: ReelMedia
      if (existingMediaId === null) {
        media = await payload.create({
          collection: 'reelMedia',
          data: { alt },
          file: await artifactUpload(artifact, metadata.shotListHash),
          // Documented admin bypass. Deterministic name: overwrite the
          // previous object instead of letting Payload suffix the filename on
          // every re-ingest.
          overwriteExistingFiles: true,
          depth: 0,
          overrideAccess: true,
          req,
        })
      } else {
        media = await payload.update({
          collection: 'reelMedia',
          id: existingMediaId,
          data: { alt },
          file: await artifactUpload(artifact, metadata.shotListHash),
          overwriteExistingFiles: true,
          depth: 0,
          // Same documented bypass on the update path.
          overrideAccess: true,
          req,
        })
      }
      mediaIds[artifact.field] = media.id
    }

    // The reader already required video + cover; the ids come from the existing
    // reel or the freshly created media, so the create data is complete.
    const requiredMediaId = (field: 'video' | 'cover'): number => {
      const id = mediaIds[field] ?? (existing === null ? null : mediaIdOf(existing[field]))
      if (id === null || id === undefined) {
        throw new Error(`artefato obrigatório sem mídia: ${field}.`)
      }
      return id
    }

    const data: ReelWriteData = {
      title: metadata.title,
      feature: metadata.feature,
      sourceHash: metadata.shotListHash,
      video: requiredMediaId('video'),
      cover: requiredMediaId('cover'),
      ...(transcript === null ? {} : { transcript }),
      ...(mediaIds.videoWithAudio === undefined ? {} : { videoWithAudio: mediaIds.videoWithAudio }),
      ...(mediaIds.narrationAudio === undefined ? {} : { narrationAudio: mediaIds.narrationAudio }),
      ...(mediaIds.captions === undefined ? {} : { captions: mediaIds.captions }),
    }

    if (existing !== null) {
      // No campaign user in the CLI: the documented admin bypass for the reel.
      const updated = await payload.update({
        collection: 'reel',
        id: existing.id,
        data,
        depth: 0,
        overrideAccess: true,
        req,
      })
      return { operation: 'updated', reelId: updated.id }
    }

    // No campaign user in the CLI: the documented admin bypass for the reel.
    const created = await payload.create({
      collection: 'reel',
      data: { ...data, status: 'published' },
      depth: 0,
      overrideAccess: true,
      req,
    })
    return { operation: 'created', reelId: created.id }
  })
}
