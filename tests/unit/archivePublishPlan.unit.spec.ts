// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_PUBLISH_DEFAULT_OUT_DIR,
  archivePublishReportStamp,
  formatArchivePublishReport,
  parseArchivePublishCliArgs,
  summarizeArchivePublishResults,
} from '../../scripts/lib/archivePublishPlan.mjs'

// C242 — the pure parser/summary of `pnpm archive:publish`: the dry-run default
// and the honest per-photo failure accounting of the bulk approval.

describe('parseArchivePublishCliArgs', () => {
  it('defaults to the dry-run and parses the options', () => {
    expect(parseArchivePublishCliArgs([])).toEqual({
      apply: false,
      limit: null,
      out: ARCHIVE_PUBLISH_DEFAULT_OUT_DIR,
      help: false,
    })

    const apply = parseArchivePublishCliArgs(['--apply', '--limit', '20', '--out', 'x'])
    expect(apply.apply).toBe(true)
    expect(apply.limit).toBe(20)
    expect(apply.out).toBe('x')
    expect(parseArchivePublishCliArgs(['--help']).help).toBe(true)
  })

  it('fails closed on a bad limit, escaping out and unknown args', () => {
    expect(() => parseArchivePublishCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseArchivePublishCliArgs(['--limit', 'x'])).toThrow(/--limit/)
    expect(() => parseArchivePublishCliArgs(['--out', '../etc'])).toThrow(/--out/)
    expect(() => parseArchivePublishCliArgs(['--apply=1'])).toThrow(/argumento desconhecido/)
    expect(() => parseArchivePublishCliArgs(['--limit'])).toThrow(/faltou valor/)
  })
})

describe('summarizeArchivePublishResults', () => {
  it('counts approvals and lists failures with the reason', () => {
    const summary = summarizeArchivePublishResults([
      { photoId: 1, status: 'approved' },
      { photoId: 2, status: 'approved' },
      { photoId: 3, status: 'failed', error: 'canal ausente' },
    ])

    expect(summary.approved).toBe(2)
    expect(summary.failed).toBe(1)
    expect(summary.failures).toEqual([{ photoId: 3, error: 'canal ausente' }])
  })

  it('keeps a preflight skip out of the failures and names its stage', () => {
    const summary = summarizeArchivePublishResults([
      { photoId: 1, status: 'approved' },
      { photoId: 4, status: 'skippedBroken', stage: 'missing', reason: 'objeto ausente' },
      { photoId: 5, status: 'skippedBroken', stage: 'decode', reason: 'Input buffer contains' },
      { photoId: 6, status: 'failed', error: 'canal ausente' },
    ])

    expect(summary.approved).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.failures).toEqual([{ photoId: 6, error: 'canal ausente' }])
    expect(summary.skippedBroken).toEqual([
      { photoId: 4, stage: 'missing', reason: 'objeto ausente' },
      { photoId: 5, stage: 'decode', reason: 'Input buffer contains' },
    ])
    expect(summary.skippedBrokenCount).toBe(2)
  })

  it('treats the plan-mode eligible census and the download stage honestly', () => {
    const summary = summarizeArchivePublishResults([
      { photoId: 1, status: 'eligible' },
      { photoId: 2, status: 'skippedBroken', stage: 'download', reason: 'checksum divergente' },
    ])

    expect(summary.approved).toBe(0)
    expect(summary.failed).toBe(0)
    expect(summary.failures).toEqual([])
    expect(summary.skippedBroken).toEqual([
      { photoId: 2, stage: 'download', reason: 'checksum divergente' },
    ])
    expect(summary.skippedBrokenCount).toBe(1)
  })
})

describe('formatting', () => {
  it('stamps the receipt name and prints the apply summary', () => {
    expect(archivePublishReportStamp('2026-10-01T04:09:04.123Z')).toBe('2026-10-01T04-09-04-123Z')

    const plan = formatArchivePublishReport({
      mode: 'plan',
      target: 'host/db',
      queue: { totalDrafts: 6492, items: 6492 },
      summary: { approved: 0, failed: 0, failures: [] },
    }).join('\n')
    expect(plan).toContain('modo: plan')
    expect(plan).toContain('fila: 6492 de 6492 draft(s)')

    const apply = formatArchivePublishReport({
      mode: 'apply',
      target: 'host/db',
      queue: { totalDrafts: 10, items: 3 },
      summary: { approved: 2, failed: 1, failures: [{ photoId: 7, error: 'sem arquivo' }] },
    }).join('\n')
    expect(apply).toContain('aprovadas: 2 | falharam: 1')
    expect(apply).toContain('✗ foto 7: sem arquivo')
  })

  it('names every skipped broken draft in the receipt lines (C249)', () => {
    const apply = formatArchivePublishReport({
      mode: 'apply',
      target: 'host/db',
      queue: { totalDrafts: 10, items: 4 },
      summary: {
        approved: 2,
        failed: 0,
        failures: [],
        skippedBroken: [
          { photoId: 8, stage: 'missing', reason: 'objeto ausente' },
          { photoId: 9, stage: 'decode', reason: 'Input buffer contains unsupported image format' },
        ],
        skippedBrokenCount: 2,
      },
    }).join('\n')
    expect(apply).toContain('aprovadas: 2 | falharam: 0 | puladas (quebradas): 2')
    expect(apply).toContain('! foto 8 fora do lote (missing): objeto ausente')
    expect(apply).toContain('! foto 9 fora do lote (decode): Input buffer contains')

    const plan = formatArchivePublishReport({
      mode: 'plan',
      target: 'host/db',
      queue: { totalDrafts: 10, items: 4 },
      summary: {
        skippedBroken: [{ photoId: 8, stage: 'missing', reason: 'objeto ausente' }],
        skippedBrokenCount: 1,
      },
    }).join('\n')
    expect(plan).toContain('drafts quebrados (fora do lote): 1')
    expect(plan).toContain('! foto 8 fora do lote (missing): objeto ausente')
    expect(plan).not.toContain('aprovadas:')
  })
})
