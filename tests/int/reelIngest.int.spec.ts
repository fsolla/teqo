// @vitest-environment node

import { copyFile, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}))

import type { ReelPackage } from '@/lib/reel'
import type { Reel } from '@/payload-types'
import config from '@/payload.config'
import { findReelBySourceHash, ingestReelPackage } from '@/utilities/reels/reelPackageIngest'
import { readReelPackage } from '../../scripts/lib/reel-ingest.mjs'

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures/reel-package')
const FIXTURE_HASH = '8f900e80b7e4628ea39050031436b25ea337e15924243e21676ea7b25bfeefc3'
const MEDIA_FIELDS = ['video', 'videoWithAudio', 'narrationAudio', 'captions', 'cover'] as const

let payload: Payload
const createdReelIds = new Set<number>()
const createdMediaIds = new Set<number>()
const tempDirs: string[] = []

const trackReel = (reel: Reel): Reel => {
  createdReelIds.add(reel.id)
  for (const field of MEDIA_FIELDS) {
    const value = reel[field]
    if (typeof value === 'number') createdMediaIds.add(value)
    else if (typeof value === 'object' && value !== null) createdMediaIds.add(value.id)
  }
  return reel
}

const tempFixture = async (mutate?: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), 'reel-package-int-'))
  tempDirs.push(directory)
  await cp(FIXTURE_DIR, directory, { recursive: true })
  if (mutate) await mutate(directory)
  return directory
}

/** The CLI passes the reader's validated output straight to the writer. */
const readPackage = (directory: string) => readReelPackage(directory) as Promise<ReelPackage>

describe('reel package ingest (C195)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of createdReelIds) {
      await payload.delete({ collection: 'reel', id, overrideAccess: true }).catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload
        .delete({ collection: 'reelMedia', id, overrideAccess: true })
        .catch(() => undefined)
    }
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('creates one published reel with every artifact linked to the same entry', async () => {
    const reelPackage = await readPackage(FIXTURE_DIR)
    const result = await ingestReelPackage(payload, reelPackage)

    expect(result.operation).toBe('created')
    const reel = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)

    expect(reel.id).toBe(result.reelId)
    expect(reel.status).toBe('published')
    expect(reel.publishedAt).toBeTruthy()
    expect(reel.title).toBe('Tutorial dos cards de apoio')
    expect(reel.feature).toBe('cards')
    expect(reel.sourceHash).toBe(FIXTURE_HASH)
    expect(reel.transcript).toContain('Roteiro do tutorial dos cards')
    for (const field of ['video', 'cover', 'captions'] as const) {
      expect(typeof reel[field], field).toBe('number')
    }
    for (const field of ['videoWithAudio', 'narrationAudio'] as const) {
      expect(reel[field], field).toBeNull()
    }

    const video = await payload.findByID({
      collection: 'reelMedia',
      id: reel.video as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(video.filename).toBe(`reel-${FIXTURE_HASH}-video.mp4`)
    expect(video.mimeType).toBe('video/mp4')
    expect(video.alt).toBe('Vídeo do reel "Tutorial dos cards de apoio"')

    const cover = await payload.findByID({
      collection: 'reelMedia',
      id: reel.cover as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(cover.alt).toBe('Tela inicial dos cards de apoio do site')

    const captions = await payload.findByID({
      collection: 'reelMedia',
      id: reel.captions as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(captions.mimeType).toBe('application/x-subrip')
  })

  it('re-ingests the same hash into the same reel and media, never a duplicate', async () => {
    const first = await readPackage(FIXTURE_DIR)
    const firstResult = await ingestReelPackage(payload, first)
    const before = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)

    const second = await readPackage(FIXTURE_DIR)
    const secondResult = await ingestReelPackage(payload, second)
    const after = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)

    expect(secondResult.operation).toBe('updated')
    expect(secondResult.reelId).toBe(firstResult.reelId)
    expect(after.id).toBe(before.id)
    expect(after.video).toBe(before.video)
    expect(after.cover).toBe(before.cover)
    expect(after.captions).toBe(before.captions)

    const matches = await payload.find({
      collection: 'reel',
      where: { sourceHash: { equals: FIXTURE_HASH } },
      depth: 0,
      overrideAccess: true,
    })
    expect(matches.totalDocs).toBe(1)
  })

  it('never resurrects an unpublished reel on re-ingest', async () => {
    const first = await readPackage(FIXTURE_DIR)
    const { reelId } = await ingestReelPackage(payload, first)
    await payload.update({
      collection: 'reel',
      id: reelId,
      data: { status: 'unpublished' },
      overrideAccess: true,
    })

    const second = await readPackage(FIXTURE_DIR)
    await ingestReelPackage(payload, second)

    const reel = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)
    expect(reel.status).toBe('unpublished')
    expect(reel.title).toBe('Tutorial dos cards de apoio')
  })

  it('keeps an optional artifact that a later package omitted', async () => {
    const withAudio = await tempFixture(async (directory) => {
      await copyFile(join(FIXTURE_DIR, 'reel.mp4'), join(directory, 'reel-audio.mp4'))
    })
    await ingestReelPackage(payload, await readPackage(withAudio))

    const before = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)
    expect(typeof before.videoWithAudio).toBe('number')

    await ingestReelPackage(payload, await readPackage(FIXTURE_DIR))

    const after = trackReel((await findReelBySourceHash(payload, FIXTURE_HASH))!)
    expect(after.videoWithAudio).toBe(before.videoWithAudio)
  })

  it('refuses an incomplete package before any database write', async () => {
    const otherHash = 'b'.repeat(64)
    const directory = await tempFixture(async (dir) => {
      await rm(join(dir, 'narracao.srt'))
      const metadata = JSON.parse(await readFile(join(dir, 'metadata.json'), 'utf8'))
      await writeFile(
        join(dir, 'metadata.json'),
        JSON.stringify({ ...metadata, shotListHash: otherHash }),
      )
    })

    await expect(readReelPackage(directory)).rejects.toThrow(/narracao\.srt/)
    expect(await findReelBySourceHash(payload, otherHash)).toBeNull()
  })
})
