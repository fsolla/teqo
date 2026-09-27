import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import { FACE_INDEX_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { FACE_SEARCH_DESCRIPTOR_LENGTH } from '@/lib/faceSearch'
import { getConsentByKey } from '@/utilities/campaignConsent'
import { enrollFaceSubject } from '@/utilities/faceSubjects/faceSubjectEnrollment'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'

import { ARCHIVE_PHOTO_JPEG_BYTES } from './archivePhotoFixture'

/**
 * C234 — the fixtures shared by the face-search int specs (subject/index and
 * the API): the file-backed archive photo over the real Payload test database
 * and the enrolled subject. The two spec files serialize on the same lease
 * because the index revision is derived state over EVERY enrolled subject — an
 * enrollment in the sibling spec changes the key and would legitimately mark
 * photos stale mid-assertion.
 */
export const FACE_SPECS_LEASE_KEY = 'c234-face-specs'
export const FACE_INDEX_LEASE_KEY = 'c234-face-index-consent'
export const FACE_SEARCH_LEASE_KEY = 'c234-face-search-consent'

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

/** Enrolls a subject with the current index Consent resolved by stable key. */
export const enrollFaceTestSubject = async ({
  payload,
  label,
  vector,
  trackedSubjectIds,
}: {
  payload: Payload
  label: string
  vector: number[]
  trackedSubjectIds: Set<number>
}): Promise<number> => {
  const consent = await getConsentByKey(payload, FACE_INDEX_CONSENT_KEY)
  if (!consent) throw new Error('index consent not configured')

  const enrolled = await enrollFaceSubject({
    payload,
    label,
    descriptor: vector,
    consent: { id: consent.id, contentHash: consent.contentHash },
  })
  trackedSubjectIds.add(enrolled.id)
  return enrolled.id
}
