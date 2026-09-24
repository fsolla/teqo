import { describe, expect, it } from 'vitest'

import {
  formatWebSpeechReport,
  isCompleteWebSpeechState,
  planWebSpeechBatch,
  summarizePlannedActions,
  summarizeWebSpeechResults,
  webSpeechPlannedAction,
} from '../../scripts/lib/webSpeeches.mjs'

type WebSpeechIngestResult =
  import('../../src/utilities/speech/webSpeechIngest.ts').WebSpeechIngestResult

// C215 — the CLI planning/reporting rules: one invalid finding fails only
// itself, duplicates are dropped by natural key and the report never hides a
// failure.

const youtube = (overrides = {}) => ({
  platform: 'youtube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  publishedAt: '2026-09-20',
  ...overrides,
})

describe('planWebSpeechBatch', () => {
  it('keeps the valid entries and reports invalid/duplicates separately', () => {
    const plan = planWebSpeechBatch([
      youtube(),
      youtube({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
      youtube({ platform: 'radio' }),
      youtube({ externalId: 'outro', url: 'https://www.youtube.com/watch?v=zzz' }),
      { platform: 'youtube', url: 'nao-e-url', publishedAt: '2026-09-20' },
    ])

    expect(plan.entries.map((entry) => entry.sourceKey)).toEqual([
      'web:youtube:https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'web:youtube:outro',
    ])
    expect(plan.duplicates).toEqual([
      { index: 1, sourceKey: 'web:youtube:https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    ])
    expect(plan.invalid.map((entry) => entry.index)).toEqual([2, 4])
  })
})

describe('webSpeechPlannedAction', () => {
  it('reads the stored state: new, incomplete, complete', () => {
    expect(webSpeechPlannedAction(null)).toBe('novo')
    expect(webSpeechPlannedAction({ segmentCount: 0, mirroredMedia: null })).toBe('atualizado')
    expect(webSpeechPlannedAction({ segmentCount: 3, mirroredMedia: null })).toBe('atualizado')
    expect(webSpeechPlannedAction({ segmentCount: 3, mirroredMedia: 9 })).toBe('ignorado')
    expect(webSpeechPlannedAction({ segmentCount: 3, mirroredMedia: 9 }, true)).toBe('reprocessado')
  })

  it('isCompleteWebSpeechState requires transcript and mirrored file', () => {
    expect(isCompleteWebSpeechState(null)).toBe(false)
    expect(isCompleteWebSpeechState({ segmentCount: 0, mirroredMedia: 1 })).toBe(false)
    expect(isCompleteWebSpeechState({ segmentCount: 1, mirroredMedia: null })).toBe(false)
    expect(isCompleteWebSpeechState({ segmentCount: 1, mirroredMedia: 1 })).toBe(true)
  })
})

describe('summarizeWebSpeechResults', () => {
  it('counts statuses, sums costs and lists every failure', () => {
    const result = (overrides: Partial<WebSpeechIngestResult>): WebSpeechIngestResult => ({
      sourceKey: 'web:youtube:x',
      status: 'skipped',
      stage: null,
      error: null,
      asrSeconds: 0,
      asrCostUsd: 0,
      llmCostUsd: null,
      ...overrides,
    })
    const summary = summarizeWebSpeechResults([
      result({ status: 'created', asrSeconds: 60, asrCostUsd: 0.00045, llmCostUsd: 0.0001 }),
      result({ status: 'updated', asrSeconds: 120, asrCostUsd: 0.0009 }),
      result({}),
      result({
        status: 'failed',
        sourceKey: 'web:audio:https://radio.example/a.mp3',
        stage: 'acquisition',
        error: 'HTTP 404',
      }),
    ])

    expect(summary).toMatchObject({ created: 1, updated: 1, skipped: 1, failed: 1 })
    expect(summary.asrSeconds).toBe(180)
    expect(summary.asrCostUsd).toBeCloseTo(0.00135, 6)
    expect(summary.llmCostUsd).toBeCloseTo(0.0001, 6)
    expect(summary.failures).toEqual([
      {
        sourceKey: 'web:audio:https://radio.example/a.mp3',
        stage: 'acquisition',
        error: 'HTTP 404',
      },
    ])
  })
})

describe('formatWebSpeechReport', () => {
  const base = {
    runAt: '2026-09-24T10:00:00.000Z',
    mode: 'import',
    findings: 4,
    planned: 3,
    invalid: [{ index: 3, error: 'url: inválida' }],
    duplicates: [{ index: 1, sourceKey: 'web:youtube:x' }],
    durationMs: 12_500,
    created: 1,
    updated: 1,
    skipped: 1,
    failed: 1,
    asrSeconds: 90,
    asrCostUsd: 0.000675,
    llmCostUsd: 0.0001,
    failures: [
      {
        sourceKey: 'web:audio:https://radio.example/a.mp3',
        stage: 'acquisition' as const,
        error: 'HTTP 404',
      },
    ],
  }

  it('prints counts, costs, the invalid entries and every failure', () => {
    const lines = formatWebSpeechReport(base).join('\n')
    expect(lines).toContain('novos: 1 · atualizados: 1 · ignorados: 1 · falhas: 1')
    expect(lines).toContain('ASR: 1min30s (~US$ 0.0007)')
    expect(lines).toContain('inválido #3')
    expect(lines).toContain('web:audio:https://radio.example/a.mp3 (acquisition): HTTP 404')
  })

  it('prints the dry-run plan instead of the execution counts', () => {
    const lines = formatWebSpeechReport({
      ...base,
      mode: 'dry-run',
      plannedActions: summarizePlannedActions([
        { action: 'novo' },
        { action: 'ignorado' },
        { action: 'reprocessado' },
      ]),
    }).join('\n')
    expect(lines).toContain('plano (dry-run): novos: 1 · atualizados: 0 · ignorados: 1')
  })
})
