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

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import config from '@/payload.config'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'
import {
  inspectPrivateMediaObject,
  resolvePrivateMediaStaticDir,
} from '@/utilities/privateMedia/privateMediaResponse'

import {
  formatArchivePublishReport,
  summarizeArchivePublishResults,
} from '../../scripts/lib/archivePublishPlan.mjs'
import { runArchivePublishBatch } from '../../scripts/publish-archive-photos.mjs'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { PHOTO_ALBUM_LEASE_KEY, withExclusiveTestDatabaseLease } from '../helpers/testDatabaseLease'

// C249 — the publish preflight over the real Payload `teqo_test`: a clean draft
// is approved, a draft whose object is corrupt/removed stays `draft` and is
// named in the receipt (stage + reason), and the plan mode classifies without
// writing. The batch seam receives its own queue, so no other spec's drafts are
// ever approved by this run.

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
  const flickrId = `c249-${randomUUID().slice(0, 8)}`
  createdFlickrIds.add(flickrId)
  const dir = await tempDir('archive-publish-')
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

const runBatch = (queue: Array<{ id: number; filename?: string | null }>, apply: boolean) =>
  runArchivePublishBatch({
    payload,
    queue,
    inspect: inspectPrivateMediaObject,
    staticDir: staticDir(),
    apply,
    log: () => undefined,
  })

const statusOf = async (id: number): Promise<string> => {
  const doc = await payload.findByID({
    collection: ARCHIVE_PHOTO_SLUG,
    id,
    depth: 0,
    overrideAccess: true,
  })
  return doc.publicationStatus
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

describe('archive publish preflight (C249)', () => {
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
    await setChannel(null)
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('approves a draft whose object inspects clean', async () => {
    const photo = await createPhoto()

    const results = await runBatch([photo], true)

    expect(results).toEqual([{ photoId: photo.id, status: 'approved' }])
    expect(await statusOf(photo.id)).toBe('approved')
  })

  it('keeps a corrupt object out of the batch and names the decode stage in the receipt', async () => {
    const photo = await createPhoto()
    await writeFile(storedPath(photo.filename), Buffer.from('isto não é uma imagem'))

    const results = await runBatch([photo], true)

    expect(results).toHaveLength(1)
    const result = results[0]
    if (!result) throw new Error('batch result missing')
    expect(result).toMatchObject({
      photoId: photo.id,
      status: 'skippedBroken',
      stage: 'decode',
    })
    expect(typeof result.reason).toBe('string')
    if (typeof result.reason === 'string') {
      expect(result.reason.length).toBeGreaterThan(0)
    }
    expect(await statusOf(photo.id)).toBe('draft')

    const summary = summarizeArchivePublishResults(results)
    expect(summary.approved).toBe(0)
    expect(summary.failed).toBe(0)
    expect(summary.skippedBrokenCount).toBe(1)
    const receipt = formatArchivePublishReport({
      mode: 'apply',
      target: 'test',
      queue: { totalDrafts: 1, items: 1 },
      summary,
    }).join('\n')
    expect(receipt).toContain(`! foto ${photo.id} fora do lote (decode):`)
    expect(receipt).toContain('puladas (quebradas): 1')
  })

  it('keeps a draft with a removed object out of the batch as missing', async () => {
    const photo = await createPhoto()
    await rm(storedPath(photo.filename), { force: true })

    const results = await runBatch([photo], true)

    expect(results).toEqual([
      { photoId: photo.id, status: 'skippedBroken', stage: 'missing', reason: 'objeto ausente' },
    ])
    expect(await statusOf(photo.id)).toBe('draft')
  })

  it('classifies a clean draft without writing in plan mode', async () => {
    const photo = await createPhoto()

    const results = await runBatch([photo], false)

    expect(results).toEqual([{ photoId: photo.id, status: 'eligible' }])
    expect(await statusOf(photo.id)).toBe('draft')
  })
})
