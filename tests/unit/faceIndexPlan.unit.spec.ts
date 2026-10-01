// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  FACE_INDEX_DEFAULT_OUT_DIR,
  faceIndexReportStamp,
  formatFaceIndexInventory,
  formatFaceIndexReport,
  parseFaceIndexCliArgs,
  summarizeFaceIndexInventory,
  summarizeFaceIndexResults,
} from '../../scripts/lib/faceIndexPlan.mjs'

// C242 — the pure parser/summaries of `pnpm faces:index`: the honest staleness
// accounting (scope B: descriptors, not subjects) and the operator-facing lines.

describe('parseFaceIndexCliArgs', () => {
  it('defaults to the dry-run and parses the modes', () => {
    expect(parseFaceIndexCliArgs([])).toEqual({
      apply: false,
      verify: false,
      limit: null,
      refresh: false,
      out: FACE_INDEX_DEFAULT_OUT_DIR,
      help: false,
    })

    const apply = parseFaceIndexCliArgs(['--apply', '--limit', '5', '--refresh', '--out', 'x'])
    expect(apply.apply).toBe(true)
    expect(apply.limit).toBe(5)
    expect(apply.refresh).toBe(true)
    expect(apply.out).toBe('x')

    expect(parseFaceIndexCliArgs(['--verify']).verify).toBe(true)
    expect(parseFaceIndexCliArgs(['--help']).help).toBe(true)
  })

  it('fails closed on mutual exclusion, bad limit and escaping out', () => {
    expect(() => parseFaceIndexCliArgs(['--apply', '--verify'])).toThrow(/mutuamente exclusivos/)
    expect(() => parseFaceIndexCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseFaceIndexCliArgs(['--limit', 'x'])).toThrow(/--limit/)
    expect(() => parseFaceIndexCliArgs(['--out', '../etc'])).toThrow(/--out/)
    expect(() => parseFaceIndexCliArgs(['--refresh=1'])).toThrow(/argumento desconhecido/)
    expect(() => parseFaceIndexCliArgs(['--limit'])).toThrow(/faltou valor/)
  })
})

describe('summarizeFaceIndexResults', () => {
  it('counts indexed photos, stored descriptors and failures with the stage', () => {
    const summary = summarizeFaceIndexResults([
      { photoId: 1, status: 'indexed', descriptorCount: 3 },
      { photoId: 2, status: 'indexed', descriptorCount: 0 },
      { photoId: 3, status: 'indexed', descriptorCount: 1 },
      { photoId: 4, status: 'failed', stage: 'download', error: 'sem arquivo' },
    ])

    expect(summary.indexed).toBe(3)
    expect(summary.descriptors).toBe(4)
    expect(summary.failed).toBe(1)
    expect(summary.failures).toEqual([{ photoId: 4, stage: 'download', error: 'sem arquivo' }])
  })
})

describe('summarizeFaceIndexInventory', () => {
  it('derives the honest gap and the stored descriptor count', () => {
    const inventory = summarizeFaceIndexInventory({
      queue: { indexKey: 'face-api@1.7.15/faceRecognitionNet', totalApproved: 10, stale: 4 },
      descriptors: 23,
    })

    expect(inventory).toEqual({
      indexKey: 'face-api@1.7.15/faceRecognitionNet',
      totalApproved: 10,
      indexed: 6,
      stale: 4,
      descriptors: 23,
    })
  })

  it('never reports a negative indexed count', () => {
    const inventory = summarizeFaceIndexInventory({
      queue: { indexKey: 'k', totalApproved: 2, stale: 5 },
      descriptors: 0,
    })
    expect(inventory.indexed).toBe(0)
  })
})

describe('formatting', () => {
  it('stamps the receipt name and prints the inventory lines', () => {
    expect(faceIndexReportStamp('2026-09-27T16:42:01.123Z')).toBe('2026-09-27T16-42-01-123Z')

    const lines = formatFaceIndexInventory(
      {
        indexKey: 'k',
        totalApproved: 10,
        indexed: 6,
        stale: 4,
        descriptors: 23,
      },
      'face-api@1.7.15/faceRecognitionNet',
    )
    const text = lines.join('\n')
    expect(text).toContain('fotos aprovadas: 10')
    expect(text).toContain('desatualizadas (a processar): 4')
    expect(text).toContain('rostos no índice (modelo atual): 23')
  })

  it('prints the apply summary with failures', () => {
    const report = {
      mode: 'apply',
      target: 'host/db',
      model: 'face-api@1.7.15/faceRecognitionNet',
      queue: { items: 3, totalApproved: 10 },
      summary: {
        indexed: 2,
        failed: 1,
        descriptors: 5,
        failures: [{ photoId: 4, stage: 'analyze', error: 'engine fora' }],
      },
    }
    const text = formatFaceIndexReport(report).join('\n')

    expect(text).toContain('modo: apply')
    expect(text).toContain('processadas: 2 | rostos indexados: 5 | falharam: 1')
    expect(text).toContain('✗ foto 4 [analyze]: engine fora')
  })
})
