// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import config from '@/payload.config'
import {
  ingestArchivePhoto,
  repairArchivePhotoObject,
  withdrawArchivePhotoFromPublic,
} from '@/utilities/flickr/archivePhotoIngest'
import {
  inspectPrivateMediaObject,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { PHOTO_ALBUM_LEASE_KEY, withExclusiveTestDatabaseLease } from '../helpers/testDatabaseLease'

// C246 — the integrity boundary over the real Payload `teqo_test`: the probe
// classification (ok/missing/corrupt through the serving path), the object
// repair on the same key (curation/status untouched), and the unrecoverable
// exit from the public (approved → draft, descriptors purged, removed intact).

let payload: Payload
const createdFlickrIds = new Set<string>()
const tempDirs: string[] = []

const CHANNEL = 'https://jorgesolla.example.org/remocao'

const record = (
  flickrId: string,
  overrides: Partial<ArchivePhotoImport> = {},
): ArchivePhotoImport => ({
  flickrId,
  sourceUrl: `https://www.flickr.com/photos/depjorgesolla/${flickrId}/`,
  owner: '12345678@N00',
  license: '0',
  title: `Foto ${flickrId}`,
  description: 'Registro do mandato',
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

const tempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const createPhoto = async (): Promise<{ id: number; flickrId: string; filename: string }> => {
  const flickrId = `c246-${randomUUID().slice(0, 8)}`
  createdFlickrIds.add(flickrId)
  const dir = await tempDir('archive-integrity-')
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  const created = await ingestArchivePhoto(payload, record(flickrId), { filePath })
  if (created.status !== 'created' || !created.filename) {
    throw new Error(`fixture not created: ${created.status}`)
  }
  return { id: created.id, flickrId, filename: created.filename }
}

const staticDir = (): string => resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)
const storedPath = (filename: string): string => join(staticDir(), filename)

const probe = async (filename: string | null) => {
  const dir = await tempDir('archive-integrity-probe-')
  return inspectPrivateMediaObject({
    media: { filename },
    staticDir: staticDir(),
    destinationPath: join(dir, 'probe.bin'),
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

const approve = async (id: number): Promise<void> => {
  // The approval guard reads the shared global; set the channel and approve
  // under the global's exclusive lease, so a parallel spec's teardown cannot
  // flip the channel between the two writes (the flake the C248 spec exposed
  // when the album specs grew).
  await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, async () => {
    await payload.updateGlobal({
      slug: 'photoAlbum',
      data: { published: true, removalChannelUrl: CHANNEL },
      overrideAccess: true,
    })
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { publicationStatus: 'approved' },
      overrideAccess: true,
    })
  })
}

const setChannel = async (removalChannelUrl: string | null): Promise<void> => {
  await withExclusiveTestDatabaseLease(payload, PHOTO_ALBUM_LEASE_KEY, () =>
    payload.updateGlobal({
      slug: 'photoAlbum',
      data: { published: removalChannelUrl !== null, removalChannelUrl },
      overrideAccess: true,
    }),
  )
}

describe('archive photo integrity (C246)', () => {
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
    // The channel is left configured on purpose (the face specs' pattern):
    // tearing it down here would race the approvals of every sibling album
    // spec sharing the global; the specs that exercise the absent-channel
    // state restore it themselves.
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('reads a stored original as ok through the serving path', async () => {
    const photo = await createPhoto()

    const inspection = await probe(photo.filename)

    expect(inspection).toEqual({ status: 'ok', bytes: ARCHIVE_PHOTO_JPEG_BYTES.length })
  })

  it('classifies an undecodable object at the decode stage', async () => {
    const photo = await createPhoto()
    await writeFile(storedPath(photo.filename), Buffer.from('isto não é uma imagem'))

    const inspection = await probe(photo.filename)

    expect(inspection.status).toBe('corrupt')
    if (inspection.status !== 'corrupt') return
    expect(inspection.stage).toBe('decode')
    expect(inspection.reason.length).toBeGreaterThan(0)
  })

  it('classifies a deleted object as missing', async () => {
    const photo = await createPhoto()
    await rm(storedPath(photo.filename), { force: true })

    expect(await probe(photo.filename)).toEqual({ status: 'missing' })
  })

  it('classifies a row without a stored filename as missing', async () => {
    expect(await probe(null)).toEqual({ status: 'missing' })
  })

  it('repairs the object on the same key without touching curation or status', async () => {
    const photo = await createPhoto()
    await approve(photo.id)
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { title: 'Título curado', curatedFields: ['alt'] },
      overrideAccess: true,
    })
    await writeFile(storedPath(photo.filename), Buffer.from('quebrado'))
    const replacement = await sharp({
      create: { width: 3, height: 3, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer()

    const dir = await tempDir('archive-integrity-repair-')
    const filePath = join(dir, photo.filename)
    await writeFile(filePath, replacement)

    const repaired = await repairArchivePhotoObject(payload, { id: photo.id, filePath })

    expect(repaired).toEqual({
      status: 'repaired',
      id: photo.id,
      filename: photo.filename,
      filesize: replacement.length,
    })
    expect(await readFile(storedPath(photo.filename))).toEqual(replacement)

    const row = await payload.findByID({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.publicationStatus).toBe('approved')
    expect(row.title).toBe('Título curado')
    expect(row.curatedFields).toEqual(['alt'])
    expect(row.filesize).toBe(replacement.length)

    // Convergence: the repaired object now inspects clean.
    expect(await probe(photo.filename)).toEqual({ status: 'ok', bytes: replacement.length })
  })

  it('reports a failed repair without touching the row', async () => {
    const photo = await createPhoto()
    const before = await payload.findByID({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      depth: 0,
      overrideAccess: true,
    })

    const failed = await repairArchivePhotoObject(payload, {
      id: photo.id,
      filePath: join(tmpdir(), 'nao-existe', photo.filename),
    })

    expect(failed.status).toBe('failed')
    if (failed.status !== 'failed') return
    expect(failed.error.length).toBeGreaterThan(0)
    const after = await payload.findByID({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.publicationStatus).toBe(before.publicationStatus)
    expect(after.title).toBe(before.title)
  })

  it('withdraws an unrecoverable approved photo to draft and purges descriptors', async () => {
    const photo = await createPhoto()
    await approve(photo.id)
    await payload.create({
      collection: 'archivePhotoFace',
      data: {
        photo: photo.id,
        model: 'modelo-de-teste',
        detectedAt: new Date().toISOString(),
        vector: [0.1, 0.2, 0.3],
      },
      overrideAccess: true,
    })

    const withdrawn = await withdrawArchivePhotoFromPublic(payload, {
      id: photo.id,
      flickrId: photo.flickrId,
    })

    expect(withdrawn).toEqual({
      status: 'withdrawn',
      id: photo.id,
      flickrId: photo.flickrId,
      previousStatus: 'approved',
    })
    expect(await statusOf(photo.id)).toBe('draft')
    const faces = await payload.find({
      collection: 'archivePhotoFace',
      where: { photo: { equals: photo.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(faces.docs).toHaveLength(0)
  })

  it('never touches a removed photo', async () => {
    const photo = await createPhoto()
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id: photo.id,
      data: { publicationStatus: 'removed' },
      overrideAccess: true,
    })

    const result = await withdrawArchivePhotoFromPublic(payload, {
      id: photo.id,
      flickrId: photo.flickrId,
    })

    expect(result).toEqual({
      status: 'skipped',
      id: photo.id,
      flickrId: photo.flickrId,
      reason: 'removed',
    })
    expect(await statusOf(photo.id)).toBe('removed')
  })

  it('keeps an already-draft photo out of the public without a write', async () => {
    const photo = await createPhoto()

    const result = await withdrawArchivePhotoFromPublic(payload, {
      id: photo.id,
      flickrId: photo.flickrId,
    })

    expect(result).toEqual({
      status: 'skipped',
      id: photo.id,
      flickrId: photo.flickrId,
      reason: 'already-draft',
    })
    expect(await statusOf(photo.id)).toBe('draft')
  })

  it('does not block the downgrade when the removal channel is absent', async () => {
    const photo = await createPhoto()
    await approve(photo.id)
    await setChannel(null)
    try {
      const withdrawn = await withdrawArchivePhotoFromPublic(payload, {
        id: photo.id,
        flickrId: photo.flickrId,
      })

      expect(withdrawn.status).toBe('withdrawn')
      expect(await statusOf(photo.id)).toBe('draft')
    } finally {
      await setChannel(CHANNEL)
    }
  })
})
