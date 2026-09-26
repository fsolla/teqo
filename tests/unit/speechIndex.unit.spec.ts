// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  formatSpeechIndexProbe,
  formatSpeechIndexReport,
  parseSpeechIndexArgs,
  speechIndexCostUsd,
  speechIndexEstimatedBytes,
  speechIndexReportStamp,
} from '../../scripts/lib/speechIndex.mjs'

// C229 — the pure CLI contract of `pnpm acervo:index`: flags, the honest
// report lines and the cost math. The DB/embedding path is covered by the int
// suite and the probe by the runbook.

describe('parseSpeechIndexArgs', () => {
  it('defaults to the whole catalog with a dry report shape', () => {
    expect(parseSpeechIndexArgs([])).toEqual({
      source: 'all',
      limit: null,
      dryRun: false,
      force: false,
      probe: null,
      top: 10,
      out: 'data/acervo-index',
      help: false,
    })
  })

  it('parses the write options', () => {
    expect(
      parseSpeechIndexArgs(['--source', 'web', '--limit', '20', '--dry-run', '--force']),
    ).toMatchObject({ source: 'web', limit: 20, dryRun: true, force: true })
  })

  it('parses the probe with its own top', () => {
    expect(parseSpeechIndexArgs(['--probe', 'combate à oposição', '--top', '5'])).toMatchObject({
      probe: 'combate à oposição',
      top: 5,
    })
  })

  it('refuses unknown sources, invalid numbers and escaping out dirs', () => {
    expect(() => parseSpeechIndexArgs(['--source', 'gravacoes'])).toThrow(/--source/)
    expect(() => parseSpeechIndexArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseSpeechIndexArgs(['--top', 'x', '--probe', 'tema'])).toThrow(/--top/)
    expect(() => parseSpeechIndexArgs(['--out', '../fora'])).toThrow(/--out/)
  })

  it('refuses mixing the read-only probe with write options', () => {
    expect(() => parseSpeechIndexArgs(['--probe', 'tema', '--force'])).toThrow(/--probe/)
    expect(() => parseSpeechIndexArgs(['--probe', 'tema', '--limit', '3'])).toThrow(/--probe/)
    expect(() => parseSpeechIndexArgs(['--top', '3'])).toThrow(/--top só vale com --probe/)
  })
})

describe('speechIndexCostUsd', () => {
  it('multiplies the tokens by the model price per million', () => {
    expect(speechIndexCostUsd(1_000_000, 0.01)).toBeCloseTo(0.01)
    expect(speechIndexCostUsd(250_000, 0.01)).toBeCloseTo(0.0025)
    expect(speechIndexCostUsd(0, 0.01)).toBe(0)
  })
})

describe('speechIndexEstimatedBytes', () => {
  it('estimates the JSON cost of the vectors', () => {
    expect(speechIndexEstimatedBytes(0, 1024)).toBe(0)
    expect(speechIndexEstimatedBytes(1000, 1024)).toBe(8_192_000)
  })
})

describe('formatSpeechIndexReport', () => {
  const base = {
    target: 'localhost/teqo_wt229',
    source: 'all',
    speeches: 100,
    upToDate: 80,
    skippedNoText: 5,
    toIndex: 15,
    units: 300,
    durationMs: 12_340,
  }

  it('renders the dry-run preview without write claims', () => {
    const lines = formatSpeechIndexReport({
      ...base,
      mode: 'dry-run',
      estimatedBytes: 8_192_000,
    })

    expect(lines[0]).toContain('modo: dry-run | fonte: all')
    expect(lines[1]).toContain('falas: 100 | atualizadas: 80 | sem texto: 5 | a indexar: 15')
    expect(lines[2]).toContain('trechos a vetorizar: 300')
    expect(lines[2]).toContain('bytes estimados: 8.2 MB')
    expect(lines[3]).toContain('duração: 12.3s')
    expect(lines.join('\n')).not.toContain('custo')
  })

  it('renders the write report with indexed, failures, tokens and cost', () => {
    const lines = formatSpeechIndexReport({
      ...base,
      mode: 'index',
      indexed: 15,
      failed: 0,
      promptTokens: 123_456,
      costUsd: 0.0012,
    })

    expect(lines[2]).toContain('indexadas: 15 | falhas: 0 | trechos vetorizados: 300')
    expect(lines[2]).toContain('tokens: 123456')
    expect(lines[2]).toContain('custo estimado: US$ 0.0012')
  })
})

describe('formatSpeechIndexProbe', () => {
  it('renders the ranked calibration lines', () => {
    const lines = formatSpeechIndexProbe('impeachment', [
      { score: 0.71234, speechAt: '2016-04-17T20:00', origin: 'camara', sourceKey: 'camara:1' },
      { score: 0.5011, speechAt: '2024-01-01T10:00', origin: 'web', sourceKey: 'web:youtube:x' },
    ])

    expect(lines[0]).toBe('[acervo:index] probe "impeachment" — top 2')
    expect(lines[1]).toBe('1. 0.7123 · 2016-04-17T20:00 · camara · camara:1')
    expect(lines[2]).toBe('2. 0.5011 · 2024-01-01T10:00 · web · web:youtube:x')
  })
})

describe('speechIndexReportStamp', () => {
  it('turns the ISO instant into a filesystem-safe stamp', () => {
    expect(speechIndexReportStamp('2026-09-26T03:41:18.123Z')).toBe('2026-09-26T03-41-18-123Z')
  })
})
