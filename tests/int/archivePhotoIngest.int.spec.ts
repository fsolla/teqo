// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import config from '@/payload.config'
import {
  findArchivePhotoByFlickrId,
  ingestArchivePhoto,
  listArchivePhotos,
} from '@/utilities/flickr/archivePhotoIngest'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

// C231 — the ingestion boundary over the real Payload `teqo_test`: the
// transactional create of row + original, the `flickrId` idempotency, the
// honest failure and the access gate (communication roles read; only the
// Payload admin mutates). The Flickr network side never enters the suite.

let payload: Payload
const createdFlickrIds = new Set<string>()
const tempDirs: string[] = []

const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const record = (
  flickrId: string,
  overrides: Partial<ArchivePhotoImport> = {},
): ArchivePhotoImport => {
  createdFlickrIds.add(flickrId)
  return {
    flickrId,
    sourceUrl: `https://www.flickr.com/photos/depjorgesolla/${flickrId}/`,
    owner: '12345678@N00',
    license: '0',
    title: `Foto ${flickrId}`,
    description: 'Registro do mandato',
    tags: ['saude', 'salvador'],
    takenAt: '2025-03-14 10:20:30',
    postedAt: '2025-03-15T10:00:00.000Z',
    albums: [{ albumId: '721777', title: 'Saúde' }],
    geo: { latitude: -12.2664, longitude: -38.9663 },
    exif: [{ tag: 'Make', label: 'Fabricante', value: 'Canon' }],
    originalUrl: `https://live.staticflickr.com/65535/${flickrId}_abcdef_o.jpg`,
    originalKind: 'original',
    ...overrides,
  }
}

const writeOriginal = async (flickrId: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'archive-photo-'))
  tempDirs.push(dir)
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  return filePath
}

describe('ingestArchivePhoto (C231)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
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
  })

  it('creates the row and the stored original in one go', async () => {
    const item = record('53123456789')
    const filePath = await writeOriginal(item.flickrId)

    const result = await ingestArchivePhoto(payload, item, { filePath })

    expect(result).toMatchObject({ status: 'created', flickrId: item.flickrId })
    const existing = await findArchivePhotoByFlickrId(payload, item.flickrId)
    expect(existing?.filename).toBe(`flickr-${item.flickrId}.jpg`)

    const found = await payload.find({
      collection: ARCHIVE_PHOTO_SLUG,
      where: { flickrId: { equals: item.flickrId } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(found.docs).toHaveLength(1)
    expect(found.docs[0]).toMatchObject({
      flickrId: item.flickrId,
      alt: `Foto ${item.flickrId}`,
      title: item.title,
      description: item.description,
      tags: [{ name: 'saude' }, { name: 'salvador' }],
      takenAt: item.takenAt,
      postedAt: item.postedAt,
      albums: [{ albumId: '721777', title: 'Saúde' }],
      geo: { latitude: -12.2664, longitude: -38.9663 },
      sourceUrl: item.sourceUrl,
      owner: item.owner,
      license: item.license,
      mimeType: 'image/jpeg',
    })
    expect(found.docs[0]?.exif).toEqual([{ tag: 'Make', label: 'Fabricante', value: 'Canon' }])

    const inventory = await listArchivePhotos(payload)
    expect(inventory.map((row) => row.flickrId)).toContain(item.flickrId)
  })

  it('converges on a re-run: the same flickrId is never duplicated nor re-created', async () => {
    const item = record('53123456790')
    const first = await ingestArchivePhoto(payload, item, {
      filePath: await writeOriginal(item.flickrId),
    })
    expect(first.status).toBe('created')

    const second = await ingestArchivePhoto(payload, item, {
      filePath: await writeOriginal(item.flickrId),
    })

    expect(second).toMatchObject({ status: 'existing', flickrId: item.flickrId })
    const found = await payload.find({
      collection: ARCHIVE_PHOTO_SLUG,
      where: { flickrId: { equals: item.flickrId } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(found.docs).toHaveLength(1)
  })

  it('reports a failed write and leaves no row behind', async () => {
    const item = record('53123456791')

    const result = await ingestArchivePhoto(payload, item, {
      filePath: join(tmpdir(), 'nao-existe', 'flickr.jpg'),
    })

    expect(result).toMatchObject({ status: 'failed', flickrId: item.flickrId, stage: 'ingest' })
    if (result.status !== 'failed') return
    expect(result.error.length).toBeGreaterThan(0)
    expect(await findArchivePhotoByFlickrId(payload, item.flickrId)).toBeNull()
  })

  it('reads only with the communication roles', async () => {
    const item = record('53123456792')
    await ingestArchivePhoto(payload, item, { filePath: await writeOriginal(item.flickrId) })

    const fixtures = campaignFixtures()
    const [communicator, coordinator, candidate, advisor, leader] = await Promise.all([
      fixtures.createCampaignUser('communicator'),
      fixtures.createCampaignUser('coordinator'),
      fixtures.createCampaignUser('candidate'),
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('leader'),
    ])

    const readAs = (user?: { collection: string; id: number }) =>
      payload.find({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: item.flickrId } },
        depth: 0,
        limit: 1,
        ...(user ? { user } : {}),
        overrideAccess: false,
      })

    await expect(readAs()).rejects.toThrow()
    await expect(readAs(advisor)).rejects.toThrow()
    await expect(readAs(leader)).rejects.toThrow()
    expect((await readAs(communicator)).docs).toHaveLength(1)
    expect((await readAs(coordinator)).docs).toHaveLength(1)
    expect((await readAs(candidate)).docs).toHaveLength(1)
  })

  it('reserves the mutations to the Payload admin', async () => {
    const item = record('53123456793')
    await ingestArchivePhoto(payload, item, { filePath: await writeOriginal(item.flickrId) })
    const existing = await findArchivePhotoByFlickrId(payload, item.flickrId)
    if (!existing) throw new Error('archive photo fixture was not created')

    const fixtures = campaignFixtures()
    const communicator = await fixtures.createCampaignUser('communicator')
    const admin = await fixtures.createAdminUser()

    await expect(
      payload.update({
        collection: ARCHIVE_PHOTO_SLUG,
        id: existing.id,
        data: { title: 'Editado' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: ARCHIVE_PHOTO_SLUG,
        id: existing.id,
        data: { title: 'Editado' },
        user: communicator,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const updated = await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: existing.id,
      data: { title: 'Editado' },
      user: admin,
      overrideAccess: false,
    })
    expect(updated.title).toBe('Editado')
  })
})
