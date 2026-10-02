// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY,
  ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR,
  archiveThumbnailEligibleRows,
  parseArchiveThumbnailCliArgs,
  parseArchiveThumbnailOnly,
  summarizeArchiveThumbnailProbe,
  summarizeArchiveThumbnailRun,
} from '../../scripts/lib/archiveThumbnailPlan.mjs'

// C248 — the pure parser/accounting of `pnpm archive:thumbnails`: the
// read-only default, the approved-only queue and the honest summary of the
// generation run (already present is a skip, not work; only real failures
// deserve a retry).

describe('parseArchiveThumbnailCliArgs', () => {
  it('defaults to the read-only plan and parses the options', () => {
    expect(parseArchiveThumbnailCliArgs([])).toEqual({
      apply: false,
      verify: false,
      only: null,
      limit: null,
      concurrency: ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY,
      out: ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR,
      help: false,
    })

    const apply = parseArchiveThumbnailCliArgs([
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
      verify: false,
      only: [80, 83],
      limit: 5,
      concurrency: 2,
      out: 'x',
      help: false,
    })

    expect(parseArchiveThumbnailCliArgs(['--verify']).verify).toBe(true)
    expect(parseArchiveThumbnailCliArgs(['--help']).help).toBe(true)
    expect(parseArchiveThumbnailCliArgs(['-h']).help).toBe(true)
  })

  it('fails closed on bad values and unknown args', () => {
    expect(() => parseArchiveThumbnailCliArgs(['--only'])).toThrow(/faltou valor/)
    expect(() => parseArchiveThumbnailCliArgs(['--only', ''])).toThrow(/--only/)
    expect(() => parseArchiveThumbnailCliArgs(['--only', '80,abc'])).toThrow(/--only/)
    expect(() => parseArchiveThumbnailCliArgs(['--only', '0'])).toThrow(/--only/)
    expect(() => parseArchiveThumbnailCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseArchiveThumbnailCliArgs(['--limit', 'x'])).toThrow(/--limit/)
    expect(() => parseArchiveThumbnailCliArgs(['--concurrency', '0'])).toThrow(/--concurrency/)
    expect(() => parseArchiveThumbnailCliArgs(['--out', '../etc'])).toThrow(/--out/)
    expect(() => parseArchiveThumbnailCliArgs(['--apply=1'])).toThrow(/argumento desconhecido/)
  })

  it('refuses the contradictory modes together', () => {
    expect(() => parseArchiveThumbnailCliArgs(['--apply', '--verify'])).toThrow(
      /mutuamente exclusivos/,
    )
  })

  it('parses --only without duplicates and refuses an empty selection', () => {
    expect(parseArchiveThumbnailOnly('80, 83,80')).toEqual([80, 83])
    expect(() => parseArchiveThumbnailOnly(' ')).toThrow(/--only/)
  })
})

describe('archiveThumbnailEligibleRows', () => {
  it('keeps only approved rows with a stored filename', () => {
    const rows = [
      { id: 1, flickrId: '1', filename: 'a.jpg', publicationStatus: 'approved' },
      { id: 2, flickrId: '2', filename: 'b.jpg', publicationStatus: 'draft' },
      { id: 3, flickrId: '3', filename: 'c.jpg', publicationStatus: 'removed' },
      { id: 4, flickrId: '4', filename: null, publicationStatus: 'approved' },
      { id: 5, flickrId: '5', filename: null, publicationStatus: 'draft' },
    ]

    expect(archiveThumbnailEligibleRows(rows)).toEqual([
      { id: 1, flickrId: '1', filename: 'a.jpg' },
    ])
    expect(archiveThumbnailEligibleRows([])).toEqual([])
  })
})

describe('summarizeArchiveThumbnailProbe', () => {
  it('counts present, missing and names the missing ids', () => {
    const summary = summarizeArchiveThumbnailProbe([
      { id: 1, flickrId: '1', present: true },
      { id: 2, flickrId: '2', present: false },
      { id: 3, flickrId: '3', present: false },
    ])
    expect(summary).toEqual({ eligible: 3, present: 1, missing: 2, missingIds: [2, 3] })
  })
})

describe('summarizeArchiveThumbnailRun', () => {
  it('separates generated, skipped-by-reason and failures', () => {
    const summary = summarizeArchiveThumbnailRun([
      { id: 1, outcome: { status: 'generated', bytes: 100 } },
      { id: 2, outcome: { status: 'generated', bytes: 50 } },
      { id: 3, outcome: { status: 'skipped', reason: 'already-present' } },
      { id: 4, outcome: { status: 'skipped', reason: 'missing-origin' } },
      { id: 5, outcome: { status: 'skipped', reason: 'corrupt-origin' } },
      { id: 6, outcome: { status: 'failed', reason: 'upload: timeout' } },
    ])

    expect(summary).toEqual({
      eligible: 6,
      generated: 2,
      skipped: 3,
      failed: 1,
      bytes: 150,
      skippedByReason: { 'already-present': 1, 'missing-origin': 1, 'corrupt-origin': 1 },
    })
  })
})
