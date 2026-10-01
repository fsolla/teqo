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
    expect(plan).toContain('drafts elegíveis: 6492')

    const apply = formatArchivePublishReport({
      mode: 'apply',
      target: 'host/db',
      queue: { totalDrafts: 10, items: 3 },
      summary: { approved: 2, failed: 1, failures: [{ photoId: 7, error: 'sem arquivo' }] },
    }).join('\n')
    expect(apply).toContain('aprovadas: 2 | falharam: 1')
    expect(apply).toContain('✗ foto 7: sem arquivo')
  })
})
