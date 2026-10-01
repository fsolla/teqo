import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import { FACE_SEARCH_DESCRIPTOR_LENGTH, FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import { writeArchivePhotoFaceDescriptors } from '@/utilities/faceIndex/faceDescriptorIndex'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'

import { ARCHIVE_PHOTO_JPEG_BYTES } from './archivePhotoFixture'

/**
 * C242 — the fixtures shared by the face-search int specs: the file-backed
 * archive photo over the real Payload test database and the indexed face rows
 * (scope B: anonymous descriptors, no subjects). The specs serialize on the
 * same lease because the in-process descriptor cache is derived state.
 */
export const FACE_SPECS_LEASE_KEY = 'c240-face-specs'
export const FACE_INDEX_LEASE_KEY = 'c240-face-index-consent'
export const FACE_SEARCH_LEASE_KEY = 'c240-face-search-consent'

export const faceTestVector = (value: number): number[] =>
  Array.from({ length: FACE_SEARCH_DESCRIPTOR_LENGTH }, () => value)

const record = (
  flickrId: string,
  overrides: Partial<ArchivePhotoImport> = {},
): ArchivePhotoImport => ({
  flickrId,
  sourceUrl: `https://www.flickr.com/photos/depjorgesolla/${flickrId}/`,
  owner: '12345678@N00',
  license: '0',
  title: `Foto ${flickrId}`,
  description: null,
  tags: [],
  takenAt: '2025-03-14 10:20:30',
  postedAt: '2025-03-15T10:00:00.000Z',
  albums: [],
  geo: null,
  exif: [],
  originalUrl: `https://live.staticflickr.com/65535/${flickrId}_abcdef_o.jpg`,
  originalKind: 'original',
  ...overrides,
})

/**
 * Ingests one archive photo fixture and optionally approves it (approval needs
 * the album's removal channel to be configured by the caller).
 */
export const createFaceTestPhoto = async ({
  payload,
  approved,
  prefix,
  trackedFlickrIds,
  tempDirs,
}: {
  payload: Payload
  approved: boolean
  prefix: string
  trackedFlickrIds: Set<string>
  tempDirs: string[]
}): Promise<{ id: number; flickrId: string }> => {
  const flickrId = `${prefix}-${randomUUID().slice(0, 8)}`
  trackedFlickrIds.add(flickrId)
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-photo-`))
  tempDirs.push(dir)
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  const created = await ingestArchivePhoto(payload, record(flickrId), { filePath })
  if (created.status !== 'created') throw new Error(`fixture not created: ${created.status}`)

  if (approved) {
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: created.id,
      data: { publicationStatus: 'approved' },
      overrideAccess: true,
    })
  }
  return { id: created.id, flickrId }
}

/**
 * Seeds the descriptor rows of one photo exactly like the batch does (rows +
 * marker, one transaction). `model` lets a spec pin the old-model contract.
 */
export const indexFaceTestPhoto = async ({
  payload,
  photoId,
  descriptors,
  model = FACE_SEARCH_MODEL,
}: {
  payload: Payload
  photoId: number
  descriptors: number[][]
  model?: string
}): Promise<number> =>
  writeArchivePhotoFaceDescriptors({
    payload,
    photoId,
    descriptors,
    indexKey: model,
  })
