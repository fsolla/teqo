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
import config from '@/payload.config'
import { removeFaceSubjectFromIndex } from '@/utilities/faceSubjects/faceSubjectEnrollment'
import {
  indexArchivePhotoFaces,
  listArchivePhotoFaceIndexQueue,
} from '@/utilities/faceSubjects/faceSubjectPhotoIndex'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createFaceTestPhoto,
  enrollFaceTestSubject,
  FACE_INDEX_LEASE_KEY,
  FACE_SEARCH_LEASE_KEY,
  FACE_SPECS_LEASE_KEY,
  faceTestVector,
} from '../helpers/faceIntFixtures'
import {
  acquireTestDatabaseLease,
  ensureLeasedConsent,
  PHOTO_ALBUM_LEASE_KEY,
  withExclusiveTestDatabaseLease,
} from '../helpers/testDatabaseLease'

// C234 — the anonymous selfie endpoint over the real Payload `teqo_test`:
// the kill switch and the Consent fail-closed layers, the A/C answer (only
// enrolled subjects, only approved photos, never a score or a third-party
// name), the opt-out by matched descriptor and the anonymous anti-abuse.

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

const createPhoto = (approved: boolean) =>
  createFaceTestPhoto({
    payload,
    approved,
    prefix: 'c234-api',
    trackedFlickrIds: createdFlickrIds,
    tempDirs,
  })

const enrollFixtureSubject = (label: string, vector: number[]) =>
  enrollFaceTestSubject({ payload, label, vector, trackedSubjectIds: createdSubjectIds })

const indexPhotoForSubject = async (photoId: number, vector: number[]): Promise<void> => {
  const queue = await listArchivePhotoFaceIndexQueue({ payload, refresh: true })
  const result = await indexArchivePhotoFaces({
    payload,
    item: queue.items.find((item) => item.id === photoId)!,
    indexKey: queue.indexKey,
    analyze: async () => [vector],
  })
  if (result.status !== 'indexed') throw new Error(`index fixture failed: ${result.status}`)
}

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

describe('selfie search endpoint (C234)', () => {
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
    for (const id of createdSubjectIds) {
      await payload.delete({ collection: 'faceSubject', id, overrideAccess: true })
    }
    await setSelfieSearchEnabled(false)
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

  it('fails closed (503) while the query Consent is not configured', async () => {
    await setSelfieSearchEnabled(true)
    try {
      // The C234 specs lease already serializes every writer of this key, so
      // the absence window is exclusive by construction.
      await payload.delete({
        collection: 'consent',
        where: { key: { equals: FACE_SEARCH_CONSENT_KEY } },
        overrideAccess: true,
      })
      const response = await post({ vector: faceTestVector(0), intent: 'search' })
      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({ ok: false, error: 'consent' })
    } finally {
      await ensureLeasedConsent(payload, {
        consentKey: FACE_SEARCH_CONSENT_KEY,
        leaseKey: FACE_SEARCH_LEASE_KEY,
      })
      await setSelfieSearchEnabled(false)
    }
  })

  it('returns only the approved photos of the matched subject, without names or score', async () => {
    const vector = faceTestVector(0)
    const subject = await enrollFixtureSubject('Pessoa encontrada', vector)
    const approved = await createPhoto(true)
    const draft = await createPhoto(false)
    await indexPhotoForSubject(approved.id, vector)

    // A draft linked by hand must never surface: the endpoint intersects the
    // subject's links with the approved public read.
    await payload.update({
      collection: 'faceSubject',
      id: subject,
      data: { matchedPhotos: [approved.id, draft.id] },
      overrideAccess: true,
    })

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

    // A face nobody enrolled in the index gets the honest empty answer.
    const stranger = await post({ vector: faceTestVector(1), intent: 'search' })
    await expect(stranger.json()).resolves.toEqual({ ok: true, found: false })

    await setSelfieSearchEnabled(false)
    await removeFaceSubjectFromIndex({ payload, id: subject })
  })

  it('serves the opt-out by matched descriptor and stops answering afterwards', async () => {
    const vector = faceTestVector(0.25)
    const subject = await enrollFixtureSubject('Sai pelo endpoint', vector)
    const approved = await createPhoto(true)
    await indexPhotoForSubject(approved.id, vector)

    await setSelfieSearchEnabled(true)
    const before = await post({ vector, intent: 'search' })
    await expect(before.json()).resolves.toMatchObject({ found: true })

    const leave = await post({ vector, intent: 'leave-index' })
    await expect(leave.json()).resolves.toEqual({ ok: true, removed: true })

    const stored = await payload.findByID({
      collection: 'faceSubject',
      id: subject,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.status).toBe('removed')
    expect(stored.vector).toBeNull()

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
    const subject = await enrollFixtureSubject('Modelo trocado', vector)
    await payload.update({
      collection: 'faceSubject',
      id: subject,
      data: { model: 'outro-modelo@0' },
      overrideAccess: true,
    })

    await setSelfieSearchEnabled(true)
    const response = await post({ vector, intent: 'search' })
    await expect(response.json()).resolves.toEqual({ ok: true, found: false })
    await setSelfieSearchEnabled(false)
  })
})
