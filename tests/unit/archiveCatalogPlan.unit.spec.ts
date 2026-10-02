import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_CATALOG_DEFAULT_OUT_DIR,
  archiveCatalogLayerLabel,
  archiveCatalogPendingForLayer,
  formatArchiveCatalogInventory,
  formatArchiveCatalogReport,
  parseArchiveCatalogCliArgs,
  summarizeArchiveCatalogInventory,
  summarizeArchiveCatalogResults,
} from '../../scripts/lib/archiveCatalogPlan.mjs'

// C232 — the pure CLI planning/reporting of the archive cataloguing: the argv
// contract, the run summaries and the `--verify` inventory the receipt and the
// stdout lines are built from. C245 adds the layer selector and the two-layer
// inventory.

describe('parseArchiveCatalogCliArgs (C232)', () => {
  it('defaults to the plan mode, the AI layer and the canonical receipt dir', () => {
    expect(parseArchiveCatalogCliArgs([])).toEqual({
      apply: false,
      verify: false,
      metadataOnly: false,
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

  it('parses the metadata-only layer selector in every mode', () => {
    expect(parseArchiveCatalogCliArgs(['--metadata-only'])).toMatchObject({
      metadataOnly: true,
      apply: false,
      verify: false,
    })
    expect(parseArchiveCatalogCliArgs(['--metadata-only', '--apply'])).toMatchObject({
      metadataOnly: true,
      apply: true,
    })
    expect(parseArchiveCatalogCliArgs(['--metadata-only', '--verify'])).toMatchObject({
      metadataOnly: true,
      verify: true,
    })
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

describe('summarizeArchiveCatalogInventory (C232/C245)', () => {
  it('separates both layers, counts the provenance and flags the missing file', () => {
    const inventory = summarizeArchiveCatalogInventory([
      {
        flickrId: '1',
        filename: 'a.jpg',
        catalog: { catalogedAt: 'x', source: 'ai', scene: 'evento', municipality: 1 },
      },
      { flickrId: '2', filename: 'b.jpg', catalog: { catalogedAt: 'x', source: 'metadata' } },
      { flickrId: '3', filename: 'c.jpg', catalog: {} },
      { flickrId: '4', filename: null, catalog: { catalogedAt: 'x', source: 'none' } },
      {
        flickrId: '5',
        filename: 'e.jpg',
        catalog: { metadataCheckedAt: 'x', source: 'metadata', municipality: 9 },
      },
    ])

    expect(inventory).toEqual({
      total: 5,
      ai: { cataloged: 3, pending: 2 },
      metadata: { checked: 4, pending: 1 },
      bySource: { ai: 1, metadata: 2, none: 1 },
      withoutScene: 2,
      withoutMunicipality: 2,
      missingFilename: ['4'],
    })
  })
})

describe('archiveCatalogLayerLabel (C245)', () => {
  it('labels the two layers in pt-BR', () => {
    expect(archiveCatalogLayerLabel('ai')).toBe('IA')
    expect(archiveCatalogLayerLabel('metadata')).toBe('metadados')
  })

  it('reads the pending gap of the selected layer only', () => {
    const inventory = {
      ai: { cataloged: 3, pending: 7 },
      metadata: { checked: 6, pending: 4 },
    }
    expect(archiveCatalogPendingForLayer(inventory, 'metadata')).toBe(4)
    expect(archiveCatalogPendingForLayer(inventory, 'ai')).toBe(7)
  })
})

describe('report lines (C232/C245)', () => {
  it('renders the plan line with the layer and the pending count', () => {
    const lines = formatArchiveCatalogReport({
      mode: 'plan',
      layer: 'ai',
      target: '127.0.0.1/teqo_staging',
      engine: { host: '100.94.122.26', model: 'qwen2.5vl:7b', scope: 'local' },
      pending: 12,
      durationMs: 1500,
    })

    expect(lines[0]).toContain('100.94.122.26 (qwen2.5vl:7b, local)')
    const text = lines.join('\n')
    expect(text).toContain('camada: IA')
    expect(text).toContain('pendentes na fila: 12')
  })

  it('renders the metadata-only plan without an engine line', () => {
    const lines = formatArchiveCatalogReport({
      mode: 'plan',
      layer: 'metadata',
      engine: null,
      pending: 3,
      durationMs: 10,
    })

    const text = lines.join('\n')
    expect(text).toContain('camada: metadados')
    expect(text).not.toContain('engine:')
  })

  it('renders the apply summary and every failure', () => {
    const lines = formatArchiveCatalogReport({
      mode: 'apply',
      layer: 'metadata',
      target: '127.0.0.1/teqo_staging',
      durationMs: 2000,
      summary: summarizeArchiveCatalogResults([
        { flickrId: '1', status: 'cataloged', source: 'ai' },
        { flickrId: '2', status: 'failed', stage: 'analyze', error: 'timeout' },
      ]),
    })

    const text = lines.join('\n')
    expect(text).toContain('camada: metadados')
    expect(text).toContain('processadas: 1')
    expect(text).toContain('falharam: 1')
    expect(text).toContain('IA: 1')
    expect(text).toContain('2 (analyze): timeout')
  })

  it('renders the verify inventory with the pending gap of each layer', () => {
    const lines = formatArchiveCatalogInventory({
      total: 5,
      ai: { cataloged: 3, pending: 2 },
      metadata: { checked: 4, pending: 1 },
      bySource: { ai: 1, metadata: 2, none: 1 },
      withoutScene: 2,
      withoutMunicipality: 2,
      missingFilename: [],
    })

    const text = lines.join('\n')
    expect(text).toContain('camada IA: catalogadas 3 · pendentes 2')
    expect(text).toContain('camada metadados: verificadas 4 · pendentes 1')
    expect(text).toContain('pendentes de metadados: 1')
    expect(text).toContain('pendentes de IA: 2')
  })
})
