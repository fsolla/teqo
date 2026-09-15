import { describe, expect, it, vi } from 'vitest'

import {
  authorNameMatches,
  fetchAuthorEmendas,
  normalizeEmendaRow,
  sumEmendas,
} from '../../scripts/lib/portalTransparenciaEmendas.mjs'

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
})

const row = (overrides: Record<string, unknown> = {}) => ({
  codigoEmenda: '202312340001',
  ano: 2023,
  tipoEmenda: 'Individual',
  codigoAutor: '1234',
  nomeAutor: 'JORGE SOLLA',
  nomeFuncao: 'Saúde',
  valorEmpenhado: 100000,
  valorLiquidado: 50000,
  valorPago: 25000,
  valorRestoPago: 1000,
  localidadeDoGasto: 'Itamaraju - BA',
  ...overrides,
})

describe('portalTransparenciaEmendas', () => {
  it('normalizes author names without accent/case', () => {
    expect(authorNameMatches('Jorge Solla', 'JORGE SOLLA')).toBe(true)
    expect(authorNameMatches('Jorge Salles', 'JORGE SOLLA')).toBe(false)
  })

  it('normalizes the API row to the fields the report uses', () => {
    const normalized = normalizeEmendaRow(row())
    expect(normalized).toEqual(
      expect.objectContaining({
        code: '202312340001',
        year: 2023,
        empenhado: 100000,
        pago: 25000,
        restoPago: 1000,
      }),
    )
  })

  it('parses the pt-BR amount strings returned by the Portal API', () => {
    const normalized = normalizeEmendaRow(
      row({
        valorEmpenhado: '81.000,00',
        valorLiquidado: '0,00',
        valorPago: '1.234,56',
        valorRestoPago: '1.000.000,01',
      }),
    )
    expect(normalized.empenhado).toBe(81000)
    expect(normalized.liquidado).toBe(0)
    expect(normalized.pago).toBe(1234.56)
    expect(normalized.restoPago).toBe(1000000.01)
  })

  it('sums phases', () => {
    const totals = sumEmendas([
      normalizeEmendaRow(row()),
      normalizeEmendaRow(row({ valorPago: 5000 })),
    ])
    expect(totals.empenhado).toBe(200000)
    expect(totals.pago).toBe(30000)
  })

  it('fails into an explicit gap without an API key', async () => {
    const result = await fetchAuthorEmendas({ years: [2023], apiKey: null })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/Chave/)
    expect(result.rows).toEqual([])
  })

  it('fetches the author exact-match and keeps only the município rows', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('nomeAutor=JORGE+SOLLA')
      expect(url).not.toContain('codigoMunicipio')
      expect(url).toContain('ano=2023')
      if (url.includes('pagina=2')) return jsonResponse([])
      return jsonResponse([
        row(),
        row({ codigoEmenda: 'uf', localidadeDoGasto: 'BAHIA (UF)' }),
        row({ nomeAutor: 'JORGE SOLLA NETO', codigoAutor: '9999' }),
      ])
    })
    const later = vi.fn(async () => jsonResponse([]))
    const result = await fetchAuthorEmendas({
      years: [2023, 2024],
      municipalityCode: '2915601',
      municipalityName: 'Itamaraju',
      apiKey: 'chave',
      fetchImpl: (url: string) => (url.includes('ano=2023') ? fetchImpl(url) : later()),
    })
    expect(result.status).toBe('ok')
    expect(result.rows).toHaveLength(1)
    expect(result.authorCode).toBe('1234')
    expect(result.requestCount).toBe(3)
  })

  it('degrades to a gap when no author row carries the município locality', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        row({ localidadeDoGasto: 'BAHIA (UF)' }),
        row({ localidadeDoGasto: 'Múltiplo' }),
      ]),
    )
    const result = await fetchAuthorEmendas({
      years: [2023],
      municipalityCode: '2915601',
      municipalityName: 'Itamaraju',
      apiKey: 'chave',
      fetchImpl,
    })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/localidade Itamaraju/)
    expect(result.detail).toMatch(/não expõe o município/)
  })

  it('degrades to a gap when two authors share the name', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([row(), row({ codigoEmenda: 'x', codigoAutor: '5678' })]),
    )
    const result = await fetchAuthorEmendas({
      years: [2023],
      municipalityCode: '2930709',
      apiKey: 'chave',
      fetchImpl,
    })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/homônimo/i)
  })

  it('degrades to a gap on HTTP failure', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 429))
    const result = await fetchAuthorEmendas({
      years: [2023],
      municipalityCode: '2930709',
      apiKey: 'chave',
      fetchImpl,
    })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/Falha/)
    expect(result.detail).toContain('429')
  })

  it('degrades to a gap when nothing matches', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]))
    const result = await fetchAuthorEmendas({
      years: [2023],
      municipalityCode: '2930709',
      apiKey: 'chave',
      fetchImpl,
    })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/Nenhuma emenda/)
  })
})
