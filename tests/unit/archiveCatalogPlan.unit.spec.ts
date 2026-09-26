import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_CATALOG_DEFAULT_OUT_DIR,
  formatArchiveCatalogInventory,
  formatArchiveCatalogReport,
  parseArchiveCatalogCliArgs,
  summarizeArchiveCatalogInventory,
  summarizeArchiveCatalogResults,
} from '../../scripts/lib/archiveCatalogPlan.mjs'

// C232 — the pure CLI planning/reporting of the archive cataloguing: the argv
// contract, the run summaries and the `--verify` inventory the receipt and the
// stdout lines are built from.

describe('parseArchiveCatalogCliArgs (C232)', () => {
  it('defaults to the plan mode and the canonical receipt dir', () => {
    expect(parseArchiveCatalogCliArgs([])).toEqual({
      apply: false,
      verify: false,
      limit: null,
      out: ARCHIVE_CATALOG_DEFAULT_OUT_DIR,
      help: false,
    })
  })

  it('parses the modes and options', () => {
    expect(
      parseArchiveCatalogCliArgs(['--apply', '--limit', '5', '--out', 'data/x']),
    ).toMatchObject({
      apply: true,
      limit: 5,
      out: 'data/x',
    })
    expect(parseArchiveCatalogCliArgs(['--verify'])).toMatchObject({ verify: true })
    expect(parseArchiveCatalogCliArgs(['--help'])).toMatchObject({ help: true })
  })

  it('refuses conflicting, unknown and unsafe input', () => {
    expect(() => parseArchiveCatalogCliArgs(['--apply', '--verify'])).toThrow(/mutuamente/)
    expect(() => parseArchiveCatalogCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseArchiveCatalogCliArgs(['--limit'])).toThrow(/faltou valor/)
    expect(() => parseArchiveCatalogCliArgs(['--force'])).toThrow(/desconhecido/)
    expect(() => parseArchiveCatalogCliArgs(['--out', '../fora'])).toThrow(/\.\./)
  })
})

describe('summarizeArchiveCatalogResults (C232)', () => {
  it('counts the outcomes, the sources and names every failure', () => {
    const summary = summarizeArchiveCatalogResults([
      { flickrId: '1', status: 'cataloged', source: 'ai' },
      { flickrId: '2', status: 'cataloged', source: 'none' },
      { flickrId: '3', status: 'skipped' },
      { flickrId: '4', status: 'failed', stage: 'analyze', error: 'engine fora do ar' },
    ])

    expect(summary).toEqual({
      cataloged: 2,
      skipped: 1,
      failed: 1,
      bySource: { ai: 1, metadata: 0, none: 1 },
      failures: [{ flickrId: '4', stage: 'analyze', error: 'engine fora do ar' }],
    })
  })
})

describe('summarizeArchiveCatalogInventory (C232)', () => {
  it('separates catalogued from pending and flags the missing file', () => {
    const inventory = summarizeArchiveCatalogInventory([
      {
        flickrId: '1',
        filename: 'a.jpg',
        catalog: { catalogedAt: 'x', source: 'ai', scene: 'evento', municipality: 1 },
      },
      { flickrId: '2', filename: 'b.jpg', catalog: { catalogedAt: 'x', source: 'metadata' } },
      { flickrId: '3', filename: 'c.jpg', catalog: {} },
      { flickrId: '4', filename: null, catalog: { catalogedAt: 'x', source: 'none' } },
    ])

    expect(inventory).toMatchObject({
      total: 4,
      cataloged: 3,
      pending: 1,
      bySource: { ai: 1, metadata: 1, none: 1 },
      withoutScene: 2,
      withoutMunicipality: 2,
      missingFilename: ['4'],
    })
  })
})

describe('report lines (C232)', () => {
  it('renders the plan line with the pending count', () => {
    const lines = formatArchiveCatalogReport({
      mode: 'plan',
      target: '127.0.0.1/teqo_staging',
      engine: { host: '100.94.122.26', model: 'qwen2.5vl:7b', scope: 'local' },
      pending: 12,
      durationMs: 1500,
    })

    expect(lines[0]).toContain('100.94.122.26 (qwen2.5vl:7b, local)')
    expect(lines.join('\n')).toContain('pendentes na fila: 12')
  })

  it('renders the apply summary and every failure', () => {
    const lines = formatArchiveCatalogReport({
      mode: 'apply',
      target: '127.0.0.1/teqo_staging',
      durationMs: 2000,
      summary: summarizeArchiveCatalogResults([
        { flickrId: '1', status: 'cataloged', source: 'ai' },
        { flickrId: '2', status: 'failed', stage: 'analyze', error: 'timeout' },
      ]),
    })

    const text = lines.join('\n')
    expect(text).toContain('processadas: 1')
    expect(text).toContain('falharam: 1')
    expect(text).toContain('IA: 1')
    expect(text).toContain('2 (analyze): timeout')
  })

  it('renders the verify inventory with the pending gap', () => {
    const lines = formatArchiveCatalogInventory({
      total: 3,
      cataloged: 2,
      pending: 1,
      bySource: { ai: 1, metadata: 1, none: 0 },
      withoutScene: 1,
      withoutMunicipality: 1,
      missingFilename: [],
    })

    const text = lines.join('\n')
    expect(text).toContain('catalogadas: 2')
    expect(text).toContain('pendentes: 1')
    expect(text).toContain('IA: 1')
    expect(text).toContain('ainda pendentes de catalogação: 1')
  })
})
