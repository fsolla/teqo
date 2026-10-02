// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { afterMock } = vi.hoisted(() => ({ afterMock: vi.fn() }))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  // The route heals the grade with `after()`, which requires a request scope;
  // the generation itself is exercised directly below. The call is captured
  // here so the wiring (and its absence on a hit) is pinned.
  return { ...actual, after: afterMock }
})

import { GET as getArchivePhotoMedia } from '@/app/(frontend)/fotos/[id]/midia/route'
import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import { archivePhotoGradeFilename } from '@/lib/archivePhotoThumbnail'
import config from '@/payload.config'
import {
  ensureArchivePhotoGrade,
  generateArchivePhotoGrade,
} from '@/utilities/archivePhotos/archivePhotoThumbnails'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'
import { resolvePrivateMediaStaticDir } from '@/utilities/privateMedia/privateMediaResponse'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { PHOTO_ALBUM_LEASE_KEY, withExclusiveTestDatabaseLease } from '../helpers/testDatabaseLease'

// C248 — the stored grade thumbnail over the real Payload `teqo_test` and the
// real local storage: generation/idempotence/failure classification, the
// sibling-key contract and the route matrix (stored AVIF on `Accept`, JPEG
// fallback otherwise, miss heals in the background).

let payload: Payload
const createdFlickrIds = new Set<string>()
const tempDirs: string[] = []

installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const CHANNEL = 'https://jorgessolla.example.org/remocao'

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

const createPhoto = async (): Promise<{ id: number; flickrId: string; filename: string }> => {
  const flickrId = `c248-${randomUUID().slice(0, 8)}`
  createdFlickrIds.add(flickrId)
  const dir = await mkdtemp(join(tmpdir(), 'archive-photo-thumb-'))
  tempDirs.push(dir)
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  const created = await ingestArchivePhoto(payload, record(flickrId), { filePath })
  if (created.status !== 'created' || !created.filename) {
    throw new Error(`fixture not created: ${created.status}`)
  }
  return { id: created.id, flickrId, filename: created.filename }
}

const setChannel = async (removalChannelUrl: string): Promise<void> => {
  await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
    payload.updateGlobal({
      slug: 'photoAlbum',
      data: { published: true, removalChannelUrl },
      overrideAccess: true,
    }),
  )
}

const closeAlbumAndClearChannel = async (): Promise<void> => {
  await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
    payload.updateGlobal({
      slug: 'photoAlbum',
      data: { published: false, removalChannelUrl: null },
      overrideAccess: true,
    }),
  )
}

const approve = async (id: number): Promise<void> => {
  await payload.update({
    collection: ARCHIVE_PHOTO_SLUG,
    id,
    data: { publicationStatus: 'approved' },
    overrideAccess: true,
  })
}

const staticDir = (): string => resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)

const gradePathOf = (filename: string): string =>
  join(staticDir(), archivePhotoGradeFilename(filename))

const exists = async (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  )

// The approval hook warms the grade fire-and-forget; awaiting `ensure` lands on
// the same in-flight generation, so the file is settled when it resolves.
const settleGrade = async (filename: string): Promise<void> => {
  await ensureArchivePhotoGrade(payload, { filename })
}

describe('archive photo grade thumbnails (C248)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await setChannel(CHANNEL)
  })

  beforeEach(() => {
    afterMock.mockClear()
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      const photo = await payload.find({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      const filename = photo.docs[0]?.filename
      if (filename) {
        await rm(gradePathOf(filename), { force: true }).catch(() => undefined)
      }
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    await closeAlbumAndClearChannel()
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('generates the sibling AVIF once and converges on re-run', async () => {
    const photo = await createPhoto()
    const gradePath = gradePathOf(photo.filename)
    await rm(gradePath, { force: true })

    const generated = await generateArchivePhotoGrade(payload, { filename: photo.filename })
    expect(generated.status).toBe('generated')
    if (generated.status === 'generated') {
      expect(generated.filename).toBe(archivePhotoGradeFilename(photo.filename))
      expect(generated.bytes).toBeGreaterThan(0)
    }

    // ISO-BMFF container with the AVIF brand: a real AVIF came out of sharp.
    const bytes = await stat(gradePath)
    expect(bytes.size).toBeGreaterThan(0)
    const file = await readFile(gradePath)
    expect(file.subarray(4, 8).toString('latin1')).toBe('ftyp')
    expect(file.subarray(8, 12).toString('latin1')).toContain('avi')

    // The existing grade is never regenerated; the ensure probe converges.
    expect(await ensureArchivePhotoGrade(payload, { filename: photo.filename })).toMatchObject({
      status: 'skipped',
      reason: 'already-present',
    })
  })

  it('warms the grade when the photo enters approval', async () => {
    const photo = await createPhoto()
    await rm(gradePathOf(photo.filename), { force: true })

    await approve(photo.id)
    await settleGrade(photo.filename)

    expect(await exists(gradePathOf(photo.filename))).toBe(true)
  })

  it('classifies a missing original as an honest skip', async () => {
    const photo = await createPhoto()
    await rm(join(staticDir(), photo.filename), { force: true })

    expect(await generateArchivePhotoGrade(payload, { filename: photo.filename })).toMatchObject({
      status: 'skipped',
      reason: 'missing-origin',
    })
  })

  it('classifies an undecodable original as an honest skip', async () => {
    const photo = await createPhoto()
    await writeFile(join(staticDir(), photo.filename), Buffer.from('not an image'))

    expect(await generateArchivePhotoGrade(payload, { filename: photo.filename })).toMatchObject({
      status: 'skipped',
      reason: 'corrupt-origin',
    })
  })

  it('serves the stored AVIF to clients that accept it and the JPEG fallback otherwise', async () => {
    const photo = await createPhoto()
    await approve(photo.id)
    await settleGrade(photo.filename)

    const avif = await getArchivePhotoMedia(
      new Request(`http://localhost/fotos/${photo.id}/midia?tamanho=grade`, {
        headers: { accept: 'image/avif,image/webp,*/*' },
      }),
      { params: Promise.resolve({ id: String(photo.id) }) },
    )
    expect(avif.status).toBe(200)
    expect(avif.headers.get('Content-Type')).toBe('image/avif')
    expect(avif.headers.get('Vary')).toBe('Accept')
    expect(avif.headers.get('Cache-Control')).toContain('no-store')
    expect(avif.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(avif.headers.get('Content-Disposition')).toContain('inline')
    // A stored hit never schedules the heal.
    expect(afterMock).not.toHaveBeenCalled()

    const jpeg = await getArchivePhotoMedia(
      new Request(`http://localhost/fotos/${photo.id}/midia?tamanho=grade`),
      { params: Promise.resolve({ id: String(photo.id) }) },
    )
    expect(jpeg.status).toBe(200)
    expect(jpeg.headers.get('Content-Type')).toBe('image/jpeg')
    expect(jpeg.headers.get('Vary')).toBe('Accept')
  })

  it('falls back to the on-the-fly JPEG when the grade is missing', async () => {
    const photo = await createPhoto()
    await approve(photo.id)
    await settleGrade(photo.filename)
    await rm(gradePathOf(photo.filename), { force: true })

    const response = await getArchivePhotoMedia(
      new Request(`http://localhost/fotos/${photo.id}/midia?tamanho=grade`, {
        headers: { accept: 'image/avif' },
      }),
      { params: Promise.resolve({ id: String(photo.id) }) },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(response.headers.get('Vary')).toBe('Accept')
    // The miss schedules the lazy heal for the next request.
    expect(afterMock).toHaveBeenCalledTimes(1)
  })
})
