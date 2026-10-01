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

import { POST as postSelfie } from '@/app/(frontend)/api/fotos/selfie/route'
import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { FACE_INDEX_CONSENT_KEY, FACE_SEARCH_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import config from '@/payload.config'
import { invalidateFaceDescriptorIndex } from '@/utilities/faceIndex/faceDescriptorReads'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createFaceTestPhoto,
  FACE_INDEX_LEASE_KEY,
  FACE_SEARCH_LEASE_KEY,
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

// C242 — the anonymous selfie endpoint over the real Payload `teqo_test`:
// the kill switch and the two Consent fail-closed layers, the scope B answer
// (anonymous descriptors of approved photos only, never a score or a
// third-party name), the opt-out by matched descriptor and the anonymous
// anti-abuse.

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
    prefix: 'c240-api',
    trackedFlickrIds: createdFlickrIds,
    tempDirs,
  })

const setSelfieSearchEnabled = async (enabled: boolean): Promise<void> => {
  await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
    payload.updateGlobal({
      slug: 'photoAlbum',
      data: { published: true, removalChannelUrl: CHANNEL, selfieSearchEnabled: enabled },
      overrideAccess: true,
    }),
  )
}

const post = (body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
  postSelfie(
    new Request('http://localhost/api/fotos/selfie', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  )

describe('selfie search endpoint (C242)', () => {
  let specsLease: Awaited<ReturnType<typeof acquireTestDatabaseLease>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    specsLease = await acquireTestDatabaseLease(payload, FACE_SPECS_LEASE_KEY)
    await ensureLeasedConsent(payload, {
      consentKey: FACE_SEARCH_CONSENT_KEY,
      leaseKey: FACE_SEARCH_LEASE_KEY,
    })
    await ensureLeasedConsent(payload, {
      consentKey: FACE_INDEX_CONSENT_KEY,
      leaseKey: FACE_INDEX_LEASE_KEY,
    })
    await setSelfieSearchEnabled(false)
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    await setSelfieSearchEnabled(false)
    invalidateFaceDescriptorIndex()
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    await specsLease.release()
  })

  it('answers closed (404) while the album kill switch is off, before anything else', async () => {
    const response = await post({ vector: faceTestVector(0), intent: 'search' })
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'closed' })
  })

  it('refuses a cross-origin request and a malformed body', async () => {
    const crossOrigin = await post(
      { vector: faceTestVector(0), intent: 'search' },
      { origin: 'https://malicioso.example' },
    )
    expect(crossOrigin.status).toBe(403)

    await setSelfieSearchEnabled(true)
    const shortVector = await post({ vector: [0, 1], intent: 'search' })
    expect(shortVector.status).toBe(400)

    const badIntent = await post({ vector: faceTestVector(0), intent: 'enroll' })
    expect(badIntent.status).toBe(400)

    const extraKey = await post({ vector: faceTestVector(0), intent: 'search', image: 'x' })
    expect(extraKey.status).toBe(400)

    const notJson = await postSelfie(
      new Request('http://localhost/api/fotos/selfie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{nope',
      }),
    )
    expect(notJson.status).toBe(400)
    await setSelfieSearchEnabled(false)
  })

  it('fails closed (503) while either Consent is not configured', async () => {
    await setSelfieSearchEnabled(true)
    try {
      await payload.delete({
        collection: 'consent',
        where: { key: { equals: FACE_SEARCH_CONSENT_KEY } },
        overrideAccess: true,
      })
      const withoutQuery = await post({ vector: faceTestVector(0), intent: 'search' })
      expect(withoutQuery.status).toBe(503)
      await expect(withoutQuery.json()).resolves.toEqual({ ok: false, error: 'consent' })

      await ensureLeasedConsent(payload, {
        consentKey: FACE_SEARCH_CONSENT_KEY,
        leaseKey: FACE_SEARCH_LEASE_KEY,
      })
      await payload.delete({
        collection: 'consent',
        where: { key: { equals: FACE_INDEX_CONSENT_KEY } },
        overrideAccess: true,
      })
      const withoutNotice = await post({ vector: faceTestVector(0), intent: 'search' })
      expect(withoutNotice.status).toBe(503)
    } finally {
      await ensureLeasedConsent(payload, {
        consentKey: FACE_INDEX_CONSENT_KEY,
        leaseKey: FACE_INDEX_LEASE_KEY,
      })
      await setSelfieSearchEnabled(false)
    }
  })

  it('returns only the approved photos with a matching face, without names or score', async () => {
    const vector = faceTestVector(0)
    const approved = await createPhoto(true)
    const draft = await createPhoto(false)
    await indexFaceTestPhoto({ payload, photoId: approved.id, descriptors: [vector] })
    // A draft with descriptor rows by hand must never surface: the endpoint
    // intersects the index with the approved public read.
    await payload.create({
      collection: 'archivePhotoFace',
      data: { photo: draft.id, model: FACE_SEARCH_MODEL, vector },
      overrideAccess: true,
    })
    invalidateFaceDescriptorIndex()

    await setSelfieSearchEnabled(true)
    const response = await post({ vector, intent: 'search' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      ok: boolean
      found: boolean
      photos: { id: number }[]
    }
    expect(body.ok).toBe(true)
    expect(body.found).toBe(true)
    expect(body.photos.map((photo) => photo.id)).toEqual([approved.id])
    expect(JSON.stringify(body)).not.toMatch(/"people"|"score"|"distance"|"similarity"/i)

    // A face nobody has in the index gets the honest empty answer.
    const stranger = await post({ vector: faceTestVector(1), intent: 'search' })
    await expect(stranger.json()).resolves.toEqual({ ok: true, found: false })

    await setSelfieSearchEnabled(false)
  })

  it('serves the opt-out by matched descriptor and stops answering afterwards', async () => {
    const vector = faceTestVector(0.25)
    const approved = await createPhoto(true)
    await indexFaceTestPhoto({ payload, photoId: approved.id, descriptors: [vector] })
    invalidateFaceDescriptorIndex()

    await setSelfieSearchEnabled(true)
    const before = await post({ vector, intent: 'search' })
    await expect(before.json()).resolves.toMatchObject({ found: true })

    const leave = await post({ vector, intent: 'leave-index' })
    await expect(leave.json()).resolves.toEqual({ ok: true, removed: true })

    const rows = await payload.count({
      collection: 'archivePhotoFace',
      where: { photo: { equals: approved.id } },
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(0)

    const after = await post({ vector, intent: 'search' })
    await expect(after.json()).resolves.toEqual({ ok: true, found: false })

    // A descriptor that matches nobody cannot remove anybody.
    const nobody = await post({ vector: faceTestVector(1), intent: 'leave-index' })
    await expect(nobody.json()).resolves.toEqual({ ok: true, removed: false })

    await setSelfieSearchEnabled(false)
  })

  it('throttles the anonymous client well before the beacon budget', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.77' }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await post({ vector: faceTestVector(0), intent: 'search' }, headers)
      expect(response.status).toBe(404)
    }
    const throttled = await post({ vector: faceTestVector(0), intent: 'search' }, headers)
    expect(throttled.status).toBe(429)
    await expect(throttled.json()).resolves.toEqual({ ok: false, error: 'rate-limited' })
  })

  it('keeps the model contract: only the current model can match', async () => {
    const vector = faceTestVector(0.75)
    const approved = await createPhoto(true)
    await indexFaceTestPhoto({
      payload,
      photoId: approved.id,
      descriptors: [vector],
      model: 'outro-modelo@0',
    })
    invalidateFaceDescriptorIndex()

    await setSelfieSearchEnabled(true)
    const response = await post({ vector, intent: 'search' })
    await expect(response.json()).resolves.toEqual({ ok: true, found: false })
    await setSelfieSearchEnabled(false)
  })
})
