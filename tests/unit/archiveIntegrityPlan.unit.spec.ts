// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY,
  ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR,
  archiveIntegrityReportStamp,
  formatArchiveIntegrityRepairReport,
  formatArchiveIntegrityScanReport,
  parseArchiveIntegrityCliArgs,
  parseArchiveIntegrityOnly,
  summarizeArchiveIntegrityRepair,
  summarizeArchiveIntegrityScan,
} from '../../scripts/lib/archiveIntegrityPlan.mjs'
import { mapWithConcurrency } from '../../scripts/lib/cli.mjs'

// C246 — the pure parser/summary of `pnpm archive:integrity`: the read-only
// default, the bounded-concurrency map and the honest accounting of the sweep
// and the repair (removed rows never enter the public gap).

describe('parseArchiveIntegrityCliArgs', () => {
  it('defaults to the read-only sweep and parses the options', () => {
    expect(parseArchiveIntegrityCliArgs([])).toEqual({
      apply: false,
      only: null,
      limit: null,
      concurrency: ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY,
      out: ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR,
      help: false,
    })

    const apply = parseArchiveIntegrityCliArgs([
      '--apply',
      '--only',
      '80,83,80',
      '--limit',
      '5',
      '--concurrency',
      '2',
      '--out',
      'x',
    ])
    expect(apply).toEqual({
      apply: true,
      only: [80, 83],
      limit: 5,
      concurrency: 2,
      out: 'x',
      help: false,
    })

    expect(parseArchiveIntegrityCliArgs(['--help']).help).toBe(true)
    expect(parseArchiveIntegrityCliArgs(['-h']).help).toBe(true)
  })

  it('fails closed on bad values and unknown args', () => {
    expect(() => parseArchiveIntegrityCliArgs(['--only'])).toThrow(/faltou valor/)
    expect(() => parseArchiveIntegrityCliArgs(['--only', ''])).toThrow(/--only/)
    expect(() => parseArchiveIntegrityCliArgs(['--only', '80,abc'])).toThrow(/--only/)
    expect(() => parseArchiveIntegrityCliArgs(['--only', '80,,83'])).toThrow(/--only/)
    expect(() => parseArchiveIntegrityCliArgs(['--only', '0'])).toThrow(/--only/)
    expect(() => parseArchiveIntegrityCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseArchiveIntegrityCliArgs(['--limit', 'x'])).toThrow(/--limit/)
    expect(() => parseArchiveIntegrityCliArgs(['--concurrency', '0'])).toThrow(/--concurrency/)
    expect(() => parseArchiveIntegrityCliArgs(['--concurrency', 'x'])).toThrow(/--concurrency/)
    expect(() => parseArchiveIntegrityCliArgs(['--out', '../etc'])).toThrow(/--out/)
    expect(() => parseArchiveIntegrityCliArgs(['--apply=1'])).toThrow(/argumento desconhecido/)
  })

  it('parses --only without duplicates and refuses an empty selection', () => {
    expect(parseArchiveIntegrityOnly('80, 83,80')).toEqual([80, 83])
    expect(() => parseArchiveIntegrityOnly(' ')).toThrow(/--only/)
  })
})

describe('mapWithConcurrency', () => {
  it('preserves order and bounds the live workers', async () => {
    let live = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      live += 1
      peak = Math.max(peak, live)
      await new Promise((resolve) => setTimeout(resolve, 5))
      live -= 1
      return item * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('handles an empty list and a concurrency above the list size', async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([])
    expect(await mapWithConcurrency(['a'], 8, async (item) => item.toUpperCase())).toEqual(['A'])
  })
})

describe('summarizeArchiveIntegrityScan', () => {
  it('keeps pending to the public gap and separates drafts and removed rows', () => {
    const summary = summarizeArchiveIntegrityScan([
      {
        id: 1,
        flickrId: '1',
        filename: 'a.jpg',
        publicationStatus: 'approved',
        status: 'ok',
        bytes: 100,
      },
      {
        id: 2,
        flickrId: '2',
        filename: 'b.jpg',
        publicationStatus: 'draft',
        status: 'ok',
        bytes: 50,
      },
      {
        id: 80,
        flickrId: '80',
        filename: 'flickr-80.jpg',
        publicationStatus: 'approved',
        status: 'corrupt',
        stage: 'download',
        reason: 'checksum',
        bytes: 0,
      },
      {
        id: 83,
        flickrId: '83',
        filename: null,
        publicationStatus: 'approved',
        status: 'missing',
        bytes: 0,
      },
      {
        id: 84,
        flickrId: '84',
        filename: 'd.jpg',
        publicationStatus: 'draft',
        status: 'corrupt',
        stage: 'decode',
        reason: 'lixo',
        bytes: 0,
      },
      {
        id: 99,
        flickrId: '99',
        filename: 'r.jpg',
        publicationStatus: 'removed',
        status: 'ok',
        bytes: 10,
      },
      {
        id: 98,
        flickrId: '98',
        filename: 'r2.jpg',
        publicationStatus: 'removed',
        status: 'corrupt',
        stage: 'decode',
        reason: 'lixo',
        bytes: 5,
      },
    ])

    expect(summary.scanned).toBe(7)
    expect(summary.ok).toBe(2)
    expect(summary.pending).toBe(2)
    expect(summary.draftBroken).toEqual([
      {
        id: 84,
        flickrId: '84',
        filename: 'd.jpg',
        publicationStatus: 'draft',
        stage: 'decode',
        reason: 'lixo',
        status: 'corrupt',
      },
    ])
    expect(summary.missing).toEqual([
      {
        id: 83,
        flickrId: '83',
        filename: null,
        publicationStatus: 'approved',
        stage: null,
        reason: null,
      },
    ])
    expect(summary.corrupted).toEqual([
      {
        id: 80,
        flickrId: '80',
        filename: 'flickr-80.jpg',
        publicationStatus: 'approved',
        stage: 'download',
        reason: 'checksum',
      },
      {
        id: 84,
        flickrId: '84',
        filename: 'd.jpg',
        publicationStatus: 'draft',
        stage: 'decode',
        reason: 'lixo',
      },
    ])
    expect(summary.removedScanned).toBe(2)
    expect(summary.removedBroken).toEqual([
      {
        id: 98,
        flickrId: '98',
        filename: 'r2.jpg',
        publicationStatus: 'removed',
        stage: 'decode',
        reason: 'lixo',
        status: 'corrupt',
      },
    ])
    expect(summary.bytes).toBe(165)
  })
})

describe('summarizeArchiveIntegrityRepair', () => {
  it('buckets recovered, unrecoverable and failed', () => {
    const summary = summarizeArchiveIntegrityRepair([
      { id: 1, flickrId: '1', filename: 'a.jpg', action: 'recovered' },
      { id: 2, flickrId: '2', filename: 'b.jpg', action: 'unrecoverable' },
      { id: 3, flickrId: '3', filename: 'c.jpg', action: 'failed' },
      { id: 4, flickrId: '4', filename: 'd.jpg', action: 'failed' },
    ])

    expect(summary.recovered.map((item) => item.id)).toEqual([1])
    expect(summary.unrecoverable.map((item) => item.id)).toEqual([2])
    expect(summary.failed.map((item) => item.id)).toEqual([3, 4])
  })
})

describe('formatting', () => {
  it('stamps the receipt name', () => {
    expect(archiveIntegrityReportStamp('2026-10-01T04:09:04.123Z')).toBe('2026-10-01T04-09-04-123Z')
  })

  it('prints the sweep counts and names every broken photo with its state', () => {
    const report = {
      scan: {
        scanned: 10,
        ok: 8,
        missing: [
          {
            id: 83,
            flickrId: '83',
            filename: null,
            publicationStatus: 'approved',
            stage: null,
            reason: null,
          },
        ],
        corrupted: [
          {
            id: 80,
            flickrId: '80',
            filename: 'flickr-80.jpg',
            publicationStatus: 'approved',
            stage: 'download',
            reason: 'checksum mismatch',
          },
        ],
        draftBroken: [],
        removedScanned: 1,
        removedBroken: [],
        pending: 2,
        bytes: 1024 * 1024,
      },
      durationMs: 2_000,
    }
    const text = formatArchiveIntegrityScanReport(report).join('\n')

    expect(text).toContain('varredura: 10 foto(s)')
    expect(text).toContain('ausentes: 1')
    expect(text).toContain('corrompidas: 1')
    expect(text).toContain('pendência pública (aprovadas quebradas): 2')
    expect(text).toContain('ausente 83 (sem arquivo, aprovada)')
    expect(text).toContain('corrompida 80 (flickr-80.jpg, aprovada) [download]: checksum mismatch')
    expect(text).toContain('1.0 MiB')
  })

  it('prints the repair buckets with provenance and the exit record', () => {
    const report = {
      repair: {
        recovered: [
          {
            id: 80,
            filename: 'flickr-80.jpg',
            bytes: 2048,
            sha256: 'abcdef0123456789',
            sourceUrl: 'https://live.staticflickr.com/x_o.jpg',
          },
        ],
        unrecoverable: [
          {
            id: 83,
            filename: null,
            previousStatus: 'approved',
            newStatus: 'draft',
            reason: 'fonte sumiu',
          },
        ],
        failed: [{ id: 84, filename: 'flickr-84.jpg', stage: 'download', reason: 'timeout' }],
      },
    }
    const text = formatArchiveIntegrityRepairReport(report).join('\n')

    expect(text).toContain('recuperadas: 1')
    expect(text).toContain('irrecuperáveis (fora do público): 1')
    expect(text).toContain('falhas: 1')
    expect(text).toContain('recuperada 80 (flickr-80.jpg)')
    expect(text).toContain('sha256:abcdef012345…')
    expect(text).toContain('irrecuperável 83 (sem arquivo) approved → draft: fonte sumiu')
    expect(text).toContain('falha 84 (flickr-84.jpg) [download]: timeout')
  })
})
