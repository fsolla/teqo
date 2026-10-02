// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: revalidateTagMock,
  unstable_cache: (fn: unknown) => fn,
}))

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { FACE_INDEX_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { FACE_SEARCH_DESCRIPTOR_LENGTH, FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import config from '@/payload.config'
import { getApprovedArchivePhotoAlbumItems } from '@/utilities/archivePhotos/archivePhotoReads'
import {
  deleteFaceDescriptorMatches,
  invalidateFaceDescriptorIndex,
} from '@/utilities/faceIndex/faceDescriptorReads'
import { loadApprovedPhotoFigureMap } from '@/utilities/faceIndex/faceFigureReads'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createFaceTestPhoto,
  FACE_INDEX_LEASE_KEY,
  FACE_SPECS_LEASE_KEY,
  faceTestVector,
  indexFaceTestPhoto,
} from '../helpers/faceIntFixtures'
import {
  acquireTestDatabaseLease,
  ensureLeasedConsent,
  PHOTO_ALBUM_LEASE_KEY,
  withExclusiveTestDatabaseLease,
} from '../helpers/testDatabaseLease'

// C244 — the curated public-figure layer over the real Payload `teqo_test`:
// the album read names only figures of the curated catalog recognized in
// APPROVED photos, the text `catalog.people` never feeds the facet, and the
// Consent notice, unapproval and the opt-out all fail closed.

let payload: Payload
const createdFlickrIds = new Set<string>()
const createdFigureIds: number[] = []
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
    prefix: 'c244',
    trackedFlickrIds: createdFlickrIds,
    tempDirs,
  })

/**
 * Direction-unique descriptor: 0.5 at one index, zero elsewhere. Two different
 * indices sit at ~0.707 euclidean distance (above the 0.45 threshold), so each
 * test's figure matches only its own photo even though the specs share the
 * test database.
 */
let nextVectorIndex = 0
const uniqueVectorIndex = (): number => (nextVectorIndex += 1)

const directionVector = (index: number): number[] => {
  const vector = faceTestVector(0)
  vector[index % FACE_SEARCH_DESCRIPTOR_LENGTH] = 0.5
  return vector
}

const createFigure = async ({
  index,
  active = true,
  model = FACE_SEARCH_MODEL,
}: {
  index: number
  active?: boolean
  model?: string
}): Promise<{ slug: string; name: string }> => {
  const suffix = randomUUID().slice(0, 8)
  const slug = `figura-${suffix}`
  const name = `Figura ${suffix}`
  const figure = await payload.create({
    collection: 'faceFigure',
    data: {
      name,
      slug,
      active,
      references: [{ model, vector: directionVector(index), source: 'retrato de teste (C244)' }],
    },
    overrideAccess: true,
  })
  createdFigureIds.push(figure.id)
  return { slug, name }
}

const albumItemOf = async (photoId: number) =>
  (await getApprovedArchivePhotoAlbumItems()).find((item) => item.id === photoId) ?? null

describe('curated public-figure album read (C244)', () => {
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
    await ensureLeasedConsent(payload, {
      consentKey: FACE_INDEX_CONSENT_KEY,
      leaseKey: FACE_INDEX_LEASE_KEY,
    })
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    for (const id of createdFigureIds) {
      await payload.delete({ collection: 'faceFigure', id, overrideAccess: true })
    }
    invalidateFaceDescriptorIndex()
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    await specsLease.release()
  })

  it('names a curated figure only in the photos where the face was indexed', async () => {
    const index = uniqueVectorIndex()
    const figure = await createFigure({ index })
    const matched = await createPhoto(true)
    const unmatched = await createPhoto(true)

    await indexFaceTestPhoto({
      payload,
      photoId: matched.id,
      descriptors: [directionVector(index)],
    })
    await indexFaceTestPhoto({
      payload,
      photoId: unmatched.id,
      descriptors: [directionVector(uniqueVectorIndex())],
    })
    // The text catalog of the matched photo names somebody else: the facet must
    // ignore it (C244 source change).
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: matched.id,
      data: { catalog: { people: ['Pessoa Só no Texto'] } },
      overrideAccess: true,
    })
    invalidateFaceDescriptorIndex()

    const matchedItem = await albumItemOf(matched.id)
    expect(matchedItem?.people).toEqual([{ slug: figure.slug, name: figure.name }])
    expect(matchedItem?.peopleLabel).toBe(figure.name)

    const unmatchedItem = await albumItemOf(unmatched.id)
    expect(unmatchedItem?.people).toEqual([])
    expect(unmatchedItem?.peopleLabel).toBeNull()
  })

  it('ignores an inactive figure and a reference of another model', async () => {
    const inactive = await createFigure({ index: uniqueVectorIndex(), active: false })
    const foreignModel = await createFigure({
      index: uniqueVectorIndex(),
      model: 'outro-modelo@1',
    })
    const photo = await createPhoto(true)
    await indexFaceTestPhoto({
      payload,
      photoId: photo.id,
      descriptors: [directionVector(uniqueVectorIndex())],
    })
    invalidateFaceDescriptorIndex()

    const item = await albumItemOf(photo.id)
    expect(item?.people).toEqual([])
    expect(item?.people.map((person) => person.slug)).not.toContain(inactive.slug)
    expect(item?.people.map((person) => person.slug)).not.toContain(foreignModel.slug)
  })

  it('fails closed with no figure names while the public notice Consent is missing', async () => {
    const index = uniqueVectorIndex()
    const figure = await createFigure({ index })
    const photo = await createPhoto(true)
    await indexFaceTestPhoto({ payload, photoId: photo.id, descriptors: [directionVector(index)] })
    invalidateFaceDescriptorIndex()

    expect((await loadApprovedPhotoFigureMap()).length).toBeGreaterThan(0)

    try {
      await payload.delete({
        collection: 'consent',
        where: { key: { equals: FACE_INDEX_CONSENT_KEY } },
        overrideAccess: true,
      })

      expect(await loadApprovedPhotoFigureMap()).toEqual([])
      const item = await albumItemOf(photo.id)
      expect(item?.people).toEqual([])
    } finally {
      await ensureLeasedConsent(payload, {
        consentKey: FACE_INDEX_CONSENT_KEY,
        leaseKey: FACE_INDEX_LEASE_KEY,
      })
    }

    const restored = await albumItemOf(photo.id)
    expect(restored?.people).toEqual([{ slug: figure.slug, name: figure.name }])
  })

  it('drops the figure names when the photo stops being approved', async () => {
    const index = uniqueVectorIndex()
    const figure = await createFigure({ index })
    const photo = await createPhoto(true)
    await indexFaceTestPhoto({ payload, photoId: photo.id, descriptors: [directionVector(index)] })
    invalidateFaceDescriptorIndex()

    expect((await albumItemOf(photo.id))?.people).toEqual([
      { slug: figure.slug, name: figure.name },
    ])

    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { publicationStatus: 'removed' },
      overrideAccess: true,
    })
    // The descriptor read has a short in-process TTL (C240); a fresh read sees
    // the purge immediately, exactly like a new request after the cache window.
    invalidateFaceDescriptorIndex()

    expect(await albumItemOf(photo.id)).toBeNull()
    expect((await loadApprovedPhotoFigureMap()).some((match) => match.photoId === photo.id)).toBe(
      false,
    )
  })

  it('removes the figure name after the opt-out and busts the album cache', async () => {
    const index = uniqueVectorIndex()
    const figure = await createFigure({ index })
    const photo = await createPhoto(true)
    const vector = directionVector(index)
    await indexFaceTestPhoto({ payload, photoId: photo.id, descriptors: [vector] })
    invalidateFaceDescriptorIndex()

    expect((await albumItemOf(photo.id))?.people).toEqual([
      { slug: figure.slug, name: figure.name },
    ])

    revalidateTagMock.mockClear()
    const deleted = await deleteFaceDescriptorMatches({ payload, vector })

    expect(deleted).toBe(1)
    expect(revalidateTagMock).toHaveBeenCalledWith('archivePhotos')
    expect((await loadApprovedPhotoFigureMap()).some((match) => match.photoId === photo.id)).toBe(
      false,
    )
    expect((await albumItemOf(photo.id))?.people).toEqual([])
  })
})
