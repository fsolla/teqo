// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

import { repairArchivePhotoFromSource } from '../../scripts/lib/archiveIntegrityRepair.mjs'
import { FlickrApiError } from '../../scripts/lib/flickrApi.mjs'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'

// C246 — the per-photo repair decision with every side effect faked: a gone
// source or an undecodable download leaves the public (withdraw); a transient
// source/download failure is retryable; a write/verification failure is never
// reported as recovered.

const tempDirs: string[] = []

type Deps = {
  row: { id: number; flickrId: string; filename: string | null; publicationStatus: string }
  tempRoot: string
  staticDir: string
  payload: unknown
  client: { getLargestSize: (flickrId: string) => Promise<{ url: string } | null> }
  download: (args: {
    url: string
    destinationPath: string
    headers: Record<string, string>
    timeoutMs: number
    maxBytes: number
  }) => Promise<void>
  repair: (
    payload: unknown,
    args: { id: number; filePath: string },
  ) => Promise<{ status: string; filename?: string | null; error?: string }>
  inspect: (args: {
    media: { filename: string | null }
    staticDir: string
    destinationPath: string
  }) => Promise<{ status: string; stage?: string; reason?: string; bytes?: number }>
  withdraw: (entry: {
    id: number
    flickrId: string
    filename: string | null
    reason: string
  }) => Promise<Record<string, unknown>>
}

const makeTempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'c246-repair-'))
  tempDirs.push(dir)
  return dir
}

const makeDeps = async (
  overrides: Partial<Deps> = {},
): Promise<{ deps: Deps; callOrder: string[] }> => {
  const callOrder: string[] = []
  const deps: Deps = {
    row: { id: 80, flickrId: '123', filename: 'flickr-123.jpg', publicationStatus: 'approved' },
    tempRoot: await makeTempRoot(),
    staticDir: '/nao-usado',
    payload: {},
    client: {
      getLargestSize: vi.fn(async () => {
        callOrder.push('source')
        return { url: 'https://live.staticflickr.com/65535/123_o.jpg' }
      }),
    },
    download: vi.fn(async ({ destinationPath }: { destinationPath: string }) => {
      callOrder.push('download')
      await writeFile(destinationPath, ARCHIVE_PHOTO_JPEG_BYTES)
    }),
    repair: vi.fn(async () => {
      callOrder.push('repair')
      return { status: 'repaired', id: 80, filename: 'flickr-123.jpg', filesize: 268 }
    }),
    inspect: vi.fn(async () => {
      callOrder.push('inspect')
      return { status: 'ok', bytes: ARCHIVE_PHOTO_JPEG_BYTES.length }
    }),
    withdraw: vi.fn(async (entry: Record<string, unknown>) => {
      callOrder.push('withdraw')
      return { ...entry, action: 'unrecoverable', previousStatus: 'approved', newStatus: 'draft' }
    }),
    ...overrides,
  }
  return { deps, callOrder }
}

const repair = (deps: Deps) => repairArchivePhotoFromSource(deps)

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('repairArchivePhotoFromSource (C246)', () => {
  it('recovers: source → download → decode → repair → verify, with provenance', async () => {
    const { deps, callOrder } = await makeDeps()

    const result = await repair(deps)

    expect(result).toMatchObject({
      id: 80,
      flickrId: '123',
      filename: 'flickr-123.jpg',
      action: 'recovered',
      sourceUrl: 'https://live.staticflickr.com/65535/123_o.jpg',
      bytes: ARCHIVE_PHOTO_JPEG_BYTES.length,
    })
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(callOrder).toEqual(['source', 'download', 'repair', 'inspect'])
    expect(basename(vi.mocked(deps.repair).mock.calls[0][1].filePath)).toBe('flickr-123.jpg')
  })

  it('withdraws when Flickr refuses the source (photo gone)', async () => {
    const client = {
      getLargestSize: vi.fn(async () => {
        throw new FlickrApiError('Flickr 1: Photo not found', { code: 1 })
      }),
    }
    const { deps } = await makeDeps({ client })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'unrecoverable', newStatus: 'draft' })
    expect(result.reason).toContain('recusou a fonte')
    expect(deps.repair).not.toHaveBeenCalled()
    expect(deps.withdraw).toHaveBeenCalledTimes(1)
  })

  it('withdraws when the source has no usable size', async () => {
    const client = { getLargestSize: vi.fn(async () => null) }
    const { deps } = await makeDeps({ client })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'unrecoverable' })
    expect(result.reason).toContain('nenhum tamanho utilizável')
  })

  it('keeps a transient source failure as a retryable failure', async () => {
    const client = {
      getLargestSize: vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      }),
    }
    const { deps } = await makeDeps({ client })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'failed', stage: 'source' })
    expect(deps.withdraw).not.toHaveBeenCalled()
  })

  it('keeps a download failure as retryable and never touches the object', async () => {
    const download = vi.fn(async () => {
      throw new Error('Download falhou (HTTP 500).')
    })
    const { deps } = await makeDeps({ download })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'failed', stage: 'download' })
    expect(deps.repair).not.toHaveBeenCalled()
    expect(deps.withdraw).not.toHaveBeenCalled()
  })

  it('withdraws when the downloaded source does not decode', async () => {
    const download = vi.fn(async ({ destinationPath }: { destinationPath: string }) => {
      await writeFile(destinationPath, Buffer.from('nao e imagem'))
    })
    const { deps } = await makeDeps({ download })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'unrecoverable' })
    expect(result.reason).toContain('não decodifica')
    expect(deps.repair).not.toHaveBeenCalled()
  })

  it('reports a failed object write without claiming recovery', async () => {
    const repairMock = vi.fn(async () => ({ status: 'failed', id: 80, error: 'boom' }))
    const { deps } = await makeDeps({ repair: repairMock })

    const result = await repair(deps)

    expect(result).toMatchObject({ action: 'failed', stage: 'repair', reason: 'boom' })
    expect(deps.inspect).not.toHaveBeenCalled()
  })

  it('reports a failed verification of the repaired object', async () => {
    const inspect = vi.fn(async () => ({
      status: 'corrupt',
      stage: 'decode',
      reason: 'ainda quebrado',
      bytes: 1,
    }))
    const { deps } = await makeDeps({ inspect })

    const result = await repair(deps)

    expect(result).toMatchObject({
      action: 'failed',
      stage: 'verify',
      reason: 'decode: ainda quebrado',
    })
  })

  it('derives the deterministic name when the row has no stored filename', async () => {
    const repairMock = vi.fn(async (_payload: unknown, { filePath }: { filePath: string }) => ({
      status: 'repaired',
      id: 81,
      filename: basename(filePath),
      filesize: 0,
    }))
    const { deps } = await makeDeps({
      row: { id: 81, flickrId: '456', filename: null, publicationStatus: 'draft' },
      repair: repairMock,
    })

    const result = await repair(deps)

    expect(result).toMatchObject({
      action: 'recovered',
      filename: 'flickr-456.jpg',
    })
    expect(basename(vi.mocked(deps.repair).mock.calls[0][1].filePath)).toBe('flickr-456.jpg')
  })
})
