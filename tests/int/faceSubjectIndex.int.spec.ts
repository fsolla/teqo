// @vitest-environment node

import { rm } from 'node:fs/promises'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { FACE_INDEX_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { FACE_SEARCH_DESCRIPTOR_LENGTH, FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import config from '@/payload.config'
import { getConsentByKey } from '@/utilities/campaignConsent'
import { removeFaceSubjectFromIndex } from '@/utilities/faceSubjects/faceSubjectEnrollment'
import {
  indexArchivePhotoFaces,
  listArchivePhotoFaceIndexQueue,
} from '@/utilities/faceSubjects/faceSubjectPhotoIndex'
import {
  getFaceSubjectMatchedPhotoIds,
  listSearchableFaceSubjects,
} from '@/utilities/faceSubjects/faceSubjectReads'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createFaceTestPhoto,
  enrollFaceTestSubject,
  FACE_INDEX_LEASE_KEY,
  FACE_SPECS_LEASE_KEY,
  faceTestVector,
} from '../helpers/faceIntFixtures'
import {
  acquireTestDatabaseLease,
  ensureLeasedConsent,
  PHOTO_ALBUM_LEASE_KEY,
  withExclusiveTestDatabaseLease,
} from '../helpers/testDatabaseLease'

// C234 — the subject/index boundary over the real Payload `teqo_test`: the
// enrollment write, the batch's transactional link replacement, the marker
// that makes the run resumable, the opt-out that erases the descriptor and the
// A/C rule that only enrolled subjects are ever searched.

let payload: Payload
const createdFlickrIds = new Set<string>()
const createdSubjectIds = new Set<number>()
const tempDirs: string[] = []

installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const CHANNEL = 'https://jorge.solla.example.org/remocao'

const createApprovedPhoto = () =>
  createFaceTestPhoto({
    payload,
    approved: true,
    prefix: 'c234',
    trackedFlickrIds: createdFlickrIds,
    tempDirs,
  })

const enrollFixtureSubject = (label: string, vector: number[]) =>
  enrollFaceTestSubject({ payload, label, vector, trackedSubjectIds: createdSubjectIds })

const markerOf = async (
  id: number,
): Promise<{ checkedAt?: string | null; checkedKey?: string | null }> => {
  const doc = await payload.findByID({
    collection: ARCHIVE_PHOTO_SLUG,
    id,
    depth: 0,
    overrideAccess: true,
  })
  return doc.faces ?? {}
}

describe('face subject enrollment and archive index (C234)', () => {
  let specsLease: Awaited<ReturnType<typeof acquireTestDatabaseLease>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    specsLease = await acquireTestDatabaseLease(payload, FACE_SPECS_LEASE_KEY)
    await ensureLeasedConsent(payload, {
      consentKey: FACE_INDEX_CONSENT_KEY,
      leaseKey: FACE_INDEX_LEASE_KEY,
    })
    await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
      payload.updateGlobal({
        slug: 'photoAlbum',
        data: { published: true, removalChannelUrl: CHANNEL },
        overrideAccess: true,
      }),
    )
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    for (const id of createdSubjectIds) {
      await payload.delete({ collection: 'faceSubject', id, overrideAccess: true })
    }
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    await specsLease.release()
  })

  it('enrolls a subject with the current model and consent snapshot', async () => {
    const consent = await getConsentByKey(payload, FACE_INDEX_CONSENT_KEY)
    const id = await enrollFixtureSubject('Pessoa de teste', faceTestVector(0))

    const stored = await payload.findByID({
      collection: 'faceSubject',
      id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.status).toBe('active')
    expect(stored.model).toBe(FACE_SEARCH_MODEL)
    expect(stored.consentHash).toBe(consent?.contentHash)
    expect(stored.vector).toHaveLength(FACE_SEARCH_DESCRIPTOR_LENGTH)
    expect(stored.enrolledAt).toBeTruthy()

    const searchable = await listSearchableFaceSubjects(payload)
    expect(searchable.map((subject) => subject.id)).toContain(id)
  })

  it('links an approved photo to the enrolled subject and stamps the marker', async () => {
    const owner = await enrollFixtureSubject('Dona da foto', faceTestVector(0))
    const photo = await createApprovedPhoto()

    const queue = await listArchivePhotoFaceIndexQueue({ payload })
    expect(queue.eligibleSubjects).toBeGreaterThanOrEqual(1)
    expect(queue.items.map((item) => item.id)).toContain(photo.id)

    const result = await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(result).toEqual({ status: 'indexed', matchedSubjects: expect.arrayContaining([owner]) })
    expect(await getFaceSubjectMatchedPhotoIds(payload, owner)).toContain(photo.id)

    const marker = await markerOf(photo.id)
    expect(marker.checkedKey).toBe(queue.indexKey)
    expect(marker.checkedAt).toBeTruthy()

    // The marker now spares the photo on the next run.
    const nextQueue = await listArchivePhotoFaceIndexQueue({ payload })
    expect(nextQueue.items.map((item) => item.id)).not.toContain(photo.id)
    const refreshed = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    expect(refreshed.items.map((item) => item.id)).toContain(photo.id)
  })

  it('removes a link that stopped matching and re-adds it when the face matches again', async () => {
    const subject = await enrollFixtureSubject('Rosto mutável', faceTestVector(0))
    const photo = await createApprovedPhoto()
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })

    const indexed = await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(indexed.status).toBe('indexed')
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).toContain(photo.id)

    const removed = await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(1)],
    })
    expect(removed.status).toBe('indexed')
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).not.toContain(photo.id)

    await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).toContain(photo.id)
  })

  it('changes the index key on a new enrollment so every photo is reprocessed', async () => {
    const queue = await listArchivePhotoFaceIndexQueue({ payload })
    await enrollFixtureSubject('Nova adesão', faceTestVector(0.5))
    const nextQueue = await listArchivePhotoFaceIndexQueue({ payload })
    expect(nextQueue.indexKey).not.toBe(queue.indexKey)
  })

  it('erases the descriptor and the links on opt-out', async () => {
    const subject = await enrollFixtureSubject('Sai do índice', faceTestVector(0))
    const photo = await createApprovedPhoto()
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).toContain(photo.id)

    await removeFaceSubjectFromIndex({ payload, id: subject })

    const stored = await payload.findByID({
      collection: 'faceSubject',
      id: subject,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.status).toBe('removed')
    expect(stored.vector).toBeNull()
    expect(stored.removedAt).toBeTruthy()
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).toEqual([])

    const searchable = await listSearchableFaceSubjects(payload)
    expect(searchable.map((candidate) => candidate.id)).not.toContain(subject)
  })

  it('fails a photo with no stored file instead of writing a link', async () => {
    const subject = await enrollFixtureSubject('Sem arquivo', faceTestVector(0))
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    const result = await indexArchivePhotoFaces({
      payload,
      item: { id: 999_999_999, filename: null, checkedKey: null },
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(result).toEqual({ status: 'failed', stage: 'download', error: expect.any(String) })
    expect(await getFaceSubjectMatchedPhotoIds(payload, subject)).toEqual([])
  })
})
