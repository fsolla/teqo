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
import { FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import config from '@/payload.config'
import {
  indexArchivePhotoFaces,
  listArchivePhotoFaceIndexQueue,
  purgeFaceDescriptorsForPhoto,
  writeArchivePhotoFaceDescriptors,
} from '@/utilities/faceIndex/faceDescriptorIndex'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createFaceTestPhoto,
  FACE_SPECS_LEASE_KEY,
  faceTestVector,
} from '../helpers/faceIntFixtures'
import {
  acquireTestDatabaseLease,
  PHOTO_ALBUM_LEASE_KEY,
  withExclusiveTestDatabaseLease,
} from '../helpers/testDatabaseLease'

// C242 — the anonymous index boundary over the real Payload `teqo_test`: the
// batch's transactional descriptor replacement, the marker that makes the run
// resumable and the purges that keep draft/removed photos out of the search.

let payload: Payload
const createdFlickrIds = new Set<string>()
const tempDirs: string[] = []

installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const CHANNEL = 'https://jorge.solla.example.org/remocao'

const createPhoto = (approved: boolean) =>
  createFaceTestPhoto({
    payload,
    approved,
    prefix: 'c240',
    trackedFlickrIds: createdFlickrIds,
    tempDirs,
  })

const faceRowsOf = async (photoId: number): Promise<number> => {
  const result = await payload.count({
    collection: 'archivePhotoFace',
    where: { photo: { equals: photoId } },
    overrideAccess: true,
  })
  return result.totalDocs
}

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

const queueItem = async (
  id: number,
  refresh = false,
): Promise<
  Awaited<ReturnType<typeof listArchivePhotoFaceIndexQueue>>['items'][number] | undefined
> => {
  const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh })
  return queue.items.find((item) => item.id === id)
}

describe('anonymous face descriptor index (C242)', () => {
  let specsLease: Awaited<ReturnType<typeof acquireTestDatabaseLease>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    specsLease = await acquireTestDatabaseLease(payload, FACE_SPECS_LEASE_KEY)
    await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
      payload.updateGlobal({
        slug: 'photoAlbum',
        data: { published: true, removalChannelUrl: CHANNEL, selfieSearchEnabled: false },
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
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    await specsLease.release()
  })

  it('lists only approved photos as stale and stamps the marker after indexing', async () => {
    const approved = await createPhoto(true)
    await createPhoto(false)

    const before = await queueItem(approved.id)
    expect(before).toBeDefined()
    expect(before?.checkedKey).toBeNull()

    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    const result = await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === approved.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0), faceTestVector(0.1)],
    })
    expect(result).toEqual({ status: 'indexed', descriptorCount: 2 })
    expect(await faceRowsOf(approved.id)).toBe(2)

    const marker = await markerOf(approved.id)
    expect(marker.checkedKey).toBe(FACE_SEARCH_MODEL)
    expect(typeof marker.checkedAt).toBe('string')

    // The marker makes the next run a no-op for this photo.
    expect(await queueItem(approved.id)).toBeUndefined()
  })

  it('replaces the rows of a photo on re-index instead of merging revisions', async () => {
    const photo = await createPhoto(true)
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    const item = queue.items.find((entry) => entry.id === photo.id)!

    await indexArchivePhotoFaces({
      payload,
      item,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0), faceTestVector(0.2), faceTestVector(0.3)],
    })
    expect(await faceRowsOf(photo.id)).toBe(3)

    await indexArchivePhotoFaces({
      payload,
      item,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0.4)],
    })
    expect(await faceRowsOf(photo.id)).toBe(1)
  })

  it('drops malformed descriptors (fail-closed) and still stamps the marker', async () => {
    const photo = await createPhoto(true)
    const written = await writeArchivePhotoFaceDescriptors({
      payload,
      photoId: photo.id,
      descriptors: [
        [1, 2, 3],
        [Number.NaN, ...faceTestVector(0).slice(1)],
      ],
      indexKey: FACE_SEARCH_MODEL,
    })
    expect(written).toBe(0)
    expect(await faceRowsOf(photo.id)).toBe(0)
    expect((await markerOf(photo.id)).checkedKey).toBe(FACE_SEARCH_MODEL)
    expect(await queueItem(photo.id)).toBeUndefined()
  })

  it('purges the descriptor rows when the photo stops being approved', async () => {
    const photo = await createPhoto(true)
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [faceTestVector(0)],
    })
    expect(await faceRowsOf(photo.id)).toBe(1)

    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { publicationStatus: 'removed' },
      overrideAccess: true,
    })
    expect(await faceRowsOf(photo.id)).toBe(0)
    expect(await queueItem(photo.id, true)).toBeUndefined()
  })

  it('purges the descriptor rows on deletion and on the explicit maintenance call', async () => {
    const photo = await createPhoto(true)
    await writeArchivePhotoFaceDescriptors({
      payload,
      photoId: photo.id,
      descriptors: [faceTestVector(0.5)],
      indexKey: FACE_SEARCH_MODEL,
    })
    expect(await faceRowsOf(photo.id)).toBe(1)

    await purgeFaceDescriptorsForPhoto({ payload, photoId: photo.id })
    expect(await faceRowsOf(photo.id)).toBe(0)

    await writeArchivePhotoFaceDescriptors({
      payload,
      photoId: photo.id,
      descriptors: [faceTestVector(0.5)],
      indexKey: FACE_SEARCH_MODEL,
    })
    await payload.delete({ collection: ARCHIVE_PHOTO_SLUG, id: photo.id, overrideAccess: true })
    const orphans = await payload.count({
      collection: 'archivePhotoFace',
      where: { photo: { equals: photo.id } },
      overrideAccess: true,
    })
    expect(orphans.totalDocs).toBe(0)
  })

  it('reports an indexed photo with zero faces honestly', async () => {
    const photo = await createPhoto(true)
    const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
    const result = await indexArchivePhotoFaces({
      payload,
      item: queue.items.find((item) => item.id === photo.id)!,
      indexKey: queue.indexKey,
      analyze: async () => [],
    })
    expect(result).toEqual({ status: 'indexed', descriptorCount: 0 })
    expect(await faceRowsOf(photo.id)).toBe(0)
    expect((await markerOf(photo.id)).checkedKey).toBe(FACE_SEARCH_MODEL)
  })
})
