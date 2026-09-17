import { describe, expect, it } from 'vitest'

import {
  fetchCamaraActivity,
  normalizeProposition,
  normalizeSpeech,
  propositionsUrl,
  speechWindows,
} from '../../scripts/lib/dossieCamara.mjs'

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

describe('normalizeProposition / normalizeSpeech', () => {
  it('builds a proposition title from sigla/numero/ano and links the tramitação', () => {
    const row = normalizeProposition({
      id: 123,
      siglaTipo: 'PL',
      numero: 456,
      ano: 2023,
      ementa: 'Dispõe sobre saúde.',
    })
    expect(row?.title).toBe('PL 456/2023')
    expect(row?.detail).toBe('Dispõe sobre saúde.')
    expect(row?.sourceUrl).toContain('idProposicao=123')
  })

  it('ignores an empty proposition row', () => {
    expect(normalizeProposition({})).toBeNull()
  })

  it('derives the speech year and keeps the API URL as source', () => {
    const row = normalizeSpeech(
      {
        dataHoraInicio: '2023-05-10T14:00:00',
        tipoDiscurso: 'DISCURSO',
        sumario: 'Fala sobre a cidade.',
      },
      178857,
    )
    expect(row?.year).toBe('2023')
    expect(row?.sourceUrl).toContain('/deputados/178857/discursos')
  })
})

describe('fetchCamaraActivity', () => {
  it('queries proposições and discursos with an explicit window and returns sourced items', async () => {
    const urls: string[] = []
    const fetchImpl = async (url: string) => {
      urls.push(url)
      if (url.includes('/proposicoes')) {
        return jsonResponse({
          dados: [{ id: 1, siglaTipo: 'PL', numero: 1, ano: 2024, ementa: 'Saúde' }],
        })
      }
      return jsonResponse({ dados: [{ dataHoraInicio: '2024-03-01T10:00:00', sumario: 'Fala' }] })
    }

    const result = await fetchCamaraActivity({
      from: '2024-01-01',
      to: '2024-12-31',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.status).toBe('ok')
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((item) => Boolean(item.sourceUrl))).toBe(true)
    const speechUrl = urls.find((url) => url.includes('/discursos'))
    expect(speechUrl).toContain('dataInicio=2024-01-01')
    expect(speechUrl).toContain('dataFim=2024-12-31')
  })

  it('degrades to an explicit gap on an HTTP failure', async () => {
    const fetchImpl = async () => jsonResponse({}, false, 500)
    const result = await fetchCamaraActivity({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.status).toBe('gap')
    expect(result.items).toEqual([])
    expect(result.reason).toMatch(/Câmara/)
  })

  it('builds the propositions URL with the deputy id', () => {
    expect(propositionsUrl(178857, 2)).toContain('idDeputadoAutor=178857')
    expect(propositionsUrl(178857, 2)).toContain('pagina=2')
  })
})

describe('speechWindows', () => {
  it('chunks the mandate into ≤4-year windows (the API rejects wider ranges)', () => {
    const windows = speechWindows('2015-01-01', '2026-09-17')
    expect(windows.length).toBeGreaterThan(1)
    for (const window of windows) {
      const span = Number(window.to.slice(0, 4)) - Number(window.from.slice(0, 4))
      expect(span).toBeLessThanOrEqual(3)
    }
    expect(windows[0]).toEqual({ from: '2015-01-01', to: '2018-12-31' })
    expect(windows.at(-1)?.to).toBe('2026-09-17')
  })

  it('keeps a single short window when the range is under four years', () => {
    expect(speechWindows('2024-01-01', '2024-12-31')).toEqual([
      { from: '2024-01-01', to: '2024-12-31' },
    ])
  })
})
