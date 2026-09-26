// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

import { GET as getArchivePhotoMedia } from '@/app/(frontend)/fotos/[id]/midia/route'
import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import config from '@/payload.config'
import {
  getApprovedArchivePhotoById,
  getApprovedArchivePhotoItems,
  hasPublishedArchivePhotos,
} from '@/utilities/archivePhotos/archivePhotoReads'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

// C233 — the public album boundary over the real Payload `teqo_test`: the
// approve/draft/removed gate, the sticky removal, the removal-channel guard,
// the município snapshot the public read depends on and the public media
// route (approved 200, everything else the same silent 404).

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

const createPhoto = async (): Promise<{ id: number; flickrId: string }> => {
  const flickrId = `c233-${randomUUID().slice(0, 8)}`
  createdFlickrIds.add(flickrId)
  const dir = await mkdtemp(join(tmpdir(), 'archive-photo-public-'))
  tempDirs.push(dir)
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  const created = await ingestArchivePhoto(payload, record(flickrId), { filePath })
  if (created.status !== 'created') throw new Error(`fixture not created: ${created.status}`)
  return { id: created.id, flickrId }
}

const setChannel = async (removalChannelUrl: string): Promise<void> => {
  await payload.updateGlobal({
    slug: 'photoAlbum',
    data: { published: true, removalChannelUrl },
    overrideAccess: true,
  })
}

/** Published is false here on purpose: the guard refuses an open album with no channel. */
const closeAlbumAndClearChannel = async (): Promise<void> => {
  await payload.updateGlobal({
    slug: 'photoAlbum',
    data: { published: false, removalChannelUrl: null },
    overrideAccess: true,
  })
}

const approve = async (id: number): Promise<void> => {
  await payload.update({
    collection: ARCHIVE_PHOTO_SLUG,
    id,
    data: { publicationStatus: 'approved' },
    overrideAccess: true,
  })
}

const statusOf = async (id: number): Promise<string> => {
  const doc = await payload.findByID({
    collection: ARCHIVE_PHOTO_SLUG,
    id,
    depth: 0,
    overrideAccess: true,
  })
  return doc.publicationStatus
}

describe('public photo album reads (C233)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await setChannel(CHANNEL)
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    await closeAlbumAndClearChannel()
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('shows only approved photos and keeps draft/removed invisible', async () => {
    const draft = await createPhoto()
    const approved = await createPhoto()
    const removed = await createPhoto()

    await approve(approved.id)
    await approve(removed.id)
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: removed.id,
      data: { publicationStatus: 'removed' },
      overrideAccess: true,
    })

    const items = await getApprovedArchivePhotoItems()
    const ids = items.map((item) => item.id)

    expect(ids).toContain(approved.id)
    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(removed.id)

    expect(await getApprovedArchivePhotoById(approved.id)).not.toBeNull()
    expect(await getApprovedArchivePhotoById(draft.id)).toBeNull()
    expect(await getApprovedArchivePhotoById(removed.id)).toBeNull()
    expect(await getApprovedArchivePhotoById(999_999_999)).toBeNull()
    expect(await hasPublishedArchivePhotos()).toBe(true)
  })

  it('refuses to approve without a valid removal channel and never lets the pipeline flip the status', async () => {
    const photo = await createPhoto()
    await closeAlbumAndClearChannel()

    await expect(approve(photo.id)).rejects.toThrow()
    expect(await statusOf(photo.id)).toBe('draft')

    // The global guard is the other half: an open album cannot lose its channel.
    await expect(
      payload.updateGlobal({
        slug: 'photoAlbum',
        data: { published: true, removalChannelUrl: null },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    await setChannel(CHANNEL)
    await approve(photo.id)

    // The cataloguing write path carries its own context and never touches the
    // publication state.
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { catalog: { caption: 'Legenda recatalogada', catalogedAt: new Date().toISOString() } },
      context: { archivePhotoCatalog: true },
      overrideAccess: true,
    })
    expect(await statusOf(photo.id)).toBe('approved')

    // `removed` is sticky: a system write on top keeps it removed.
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { publicationStatus: 'removed' },
      overrideAccess: true,
    })
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { catalog: { caption: 'Legenda de novo', catalogedAt: new Date().toISOString() } },
      context: { archivePhotoCatalog: true },
      overrideAccess: true,
    })
    expect(await statusOf(photo.id)).toBe('removed')
    expect(await getApprovedArchivePhotoById(photo.id)).toBeNull()
  })

  it('snapshots the município name/slug on the row so the public read never touches the campaign-only collection', async () => {
    const photo = await createPhoto()
    const municipality = await payload.find({
      collection: 'municipality',
      where: { slug: { equals: 'feira-de-santana' } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const municipalityId = municipality.docs[0]?.id
    expect(municipalityId).toBeDefined()

    const updated = await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { catalog: { municipality: municipalityId } },
      overrideAccess: true,
    })
    expect(updated.municipalityName).toBe('Feira de Santana')
    expect(updated.municipalitySlug).toBe('feira-de-santana')

    await approve(photo.id)
    const item = await getApprovedArchivePhotoById(photo.id)
    expect(item?.municipalityName).toBe('Feira de Santana')
    expect(item?.municipalitySlug).toBe('feira-de-santana')
  })

  it('serves the approved photo through the media route and 404s every other state', async () => {
    const approved = await createPhoto()
    await approve(approved.id)
    const draft = await createPhoto()

    const thumbnail = await getArchivePhotoMedia(
      new Request(`http://localhost/fotos/${approved.id}/midia?tamanho=grade`),
      { params: Promise.resolve({ id: String(approved.id) }) },
    )
    expect(thumbnail.status).toBe(200)
    expect(thumbnail.headers.get('Content-Type')).toBe('image/jpeg')
    expect(thumbnail.headers.get('X-Robots-Tag')).toBe('noindex')

    const download = await getArchivePhotoMedia(
      new Request(`http://localhost/fotos/${approved.id}/midia?download=1`),
      { params: Promise.resolve({ id: String(approved.id) }) },
    )
    expect(download.status).toBe(200)
    expect(download.headers.get('Content-Disposition')).toContain('attachment')
    expect(download.headers.get('Content-Disposition')).toContain(
      `jorge-solla-1313-foto-${approved.id}`,
    )

    for (const id of [draft.id, 999_999_999]) {
      const response = await getArchivePhotoMedia(
        new Request(`http://localhost/fotos/${id}/midia`),
        {
          params: Promise.resolve({ id: String(id) }),
        },
      )
      expect(response.status).toBe(404)
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    }

    const garbage = await getArchivePhotoMedia(new Request('http://localhost/fotos/x/midia'), {
      params: Promise.resolve({ id: 'x' }),
    })
    expect(garbage.status).toBe(404)
  })
})
