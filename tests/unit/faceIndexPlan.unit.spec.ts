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

// C234 — the pure parser/summaries of `pnpm faces:index`: the honest staleness
// accounting and the operator-facing lines.

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
  it('counts indexed/linked/failed and aggregates links per subject', () => {
    const summary = summarizeFaceIndexResults([
      { photoId: 1, status: 'indexed', matchedSubjects: [3, 4] },
      { photoId: 2, status: 'indexed', matchedSubjects: [3] },
      { photoId: 3, status: 'indexed', matchedSubjects: [] },
      { photoId: 4, status: 'failed', stage: 'download', error: 'sem arquivo' },
    ])

    expect(summary.indexed).toBe(3)
    expect(summary.failed).toBe(1)
    expect(summary.linkedPhotos).toBe(2)
    expect(summary.linksBySubject).toEqual([
      { subjectId: 3, photos: 2 },
      { subjectId: 4, photos: 1 },
    ])
    expect(summary.failures).toEqual([{ photoId: 4, stage: 'download', error: 'sem arquivo' }])
  })
})

describe('summarizeFaceIndexInventory', () => {
  const queue = { indexKey: 'k', eligibleSubjects: 2, totalApproved: 10, stale: 4 }
  const subjects = [
    {
      id: 1,
      status: 'active',
      model: 'face-api@1.7.15/faceRecognitionNet',
      consentHash: 'hash-atual',
      vector: [0],
      matchedPhotoIds: [1, 2],
    },
    {
      id: 2,
      status: 'active',
      model: 'face-api@1.7.15/faceRecognitionNet',
      consentHash: 'hash-antigo',
      vector: [0],
      matchedPhotoIds: [],
    },
    {
      id: 3,
      status: 'removed',
      model: 'face-api@1.7.15/faceRecognitionNet',
      consentHash: 'hash-atual',
      vector: null,
      matchedPhotoIds: [],
    },
  ]

  it('derives the honest gap, the consent staleness and the links breakdown', () => {
    const inventory = summarizeFaceIndexInventory({
      queue,
      subjects,
      currentConsentHash: 'hash-atual',
    })

    expect(inventory).toEqual({
      indexKey: 'k',
      totalApproved: 10,
      indexed: 6,
      stale: 4,
      eligibleSubjects: 2,
      activeSubjects: 2,
      removedSubjects: 1,
      staleConsentSubjects: 1,
      linkedPhotos: 2,
      linksBySubject: [{ subjectId: 1, photos: 2 }],
    })
  })

  it('treats a missing current consent as stale for everyone', () => {
    const inventory = summarizeFaceIndexInventory({
      queue,
      subjects,
      currentConsentHash: null,
    })
    expect(inventory.staleConsentSubjects).toBe(2)
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
        eligibleSubjects: 2,
        activeSubjects: 2,
        removedSubjects: 1,
        staleConsentSubjects: 1,
        linkedPhotos: 2,
        linksBySubject: [{ subjectId: 1, photos: 2 }],
      },
      'face-api@1.7.15/faceRecognitionNet',
    )
    const text = lines.join('\n')
    expect(text).toContain('fotos aprovadas: 10')
    expect(text).toContain('desatualizadas (a processar): 4')
    expect(text).toContain('consentimento vencido')
    expect(text).toContain('sujeito #1: 2 foto(s)')
  })

  it('prints the apply summary with failures', () => {
    const report = {
      mode: 'apply',
      target: 'host/db',
      model: 'face-api@1.7.15/faceRecognitionNet',
      queue: { items: 3, totalApproved: 10, eligibleSubjects: 1 },
      summary: {
        indexed: 2,
        failed: 1,
        linkedPhotos: 1,
        linksBySubject: [{ subjectId: 3, photos: 1 }],
        failures: [{ photoId: 4, stage: 'analyze', error: 'engine fora' }],
      },
    }
    const text = formatFaceIndexReport(report).join('\n')

    expect(text).toContain('modo: apply')
    expect(text).toContain('processadas: 2 | vinculadas a alguém: 1 | falharam: 1')
    expect(text).toContain('sujeito #3: 1 foto(s)')
    expect(text).toContain('✗ foto 4 [analyze]: engine fora')
  })
})
