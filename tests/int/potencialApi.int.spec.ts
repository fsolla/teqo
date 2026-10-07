// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { GET as getMunicipios } from '@/app/(frontend)/api/potencial/municipios/route'
import { GET as getSecao } from '@/app/(frontend)/api/potencial/secao/route'

/**
 * S46 — the two public reads of `/potencial` over the committed TSE artifact:
 * the município list of a UF and the raw numbers of one real section
 * (Serrinha/BA ZE 150 seção 50, conferida contra o CSV do TSE). Guards:
 * same-origin, strict query, rate limit and the honest 404.
 */
const request = (path: string, headers: Record<string, string> = {}): Request =>
  new Request(`http://localhost${path}`, { headers })

describe('GET /api/potencial/municipios', () => {
  it('lists the municípios of a UF, alphabetically, with a day cache', async () => {
    const response = await getMunicipios(request('/api/potencial/municipios?uf=BA'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=86400')
    const body = (await response.json()) as {
      ok: boolean
      municipalities: { code: number; name: string }[]
    }
    expect(body.ok).toBe(true)
    expect(body.municipalities).toHaveLength(417)
    expect(body.municipalities).toContainEqual({ code: 39098, name: 'Serrinha' })
    const names = body.municipalities.map((municipality) => municipality.name)
    expect([...names].sort((left, right) => left.localeCompare(right, 'pt-BR'))).toEqual(names)
  })

  it('rejects a malformed query and a cross-origin request', async () => {
    expect((await getMunicipios(request('/api/potencial/municipios?uf=ba'))).status).toBe(400)
    expect((await getMunicipios(request('/api/potencial/municipios'))).status).toBe(400)
    expect((await getMunicipios(request('/api/potencial/municipios?uf=BA&extra=1'))).status).toBe(
      400,
    )
    expect(
      (
        await getMunicipios(
          request('/api/potencial/municipios?uf=BA', { origin: 'https://evil.example' }),
        )
      ).status,
    ).toBe(403)
  })
})

describe('GET /api/potencial/secao', () => {
  it('answers the raw numbers of a real section', async () => {
    const response = await getSecao(
      request('/api/potencial/secao?uf=BA&codigo=39098&zona=150&secao=50'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=86400')
    expect(await response.json()).toEqual({
      ok: true,
      section: {
        uf: 'BA',
        municipalityCode: 39098,
        municipalityName: 'Serrinha',
        zone: 150,
        section: 50,
        aptos: 376,
        comparecimento: 289,
        lula: 174,
        flavio: 76,
        validos: 260,
      },
    })
  })

  it('answers 404 for an unknown section and 400 for a malformed query', async () => {
    expect(
      (await getSecao(request('/api/potencial/secao?uf=BA&codigo=39098&zona=150&secao=9999')))
        .status,
    ).toBe(404)
    expect(
      (await getSecao(request('/api/potencial/secao?uf=BA&codigo=1&zona=150&secao=50'))).status,
    ).toBe(404)
    expect(
      (await getSecao(request('/api/potencial/secao?uf=BA&codigo=39098&zona=0&secao=50')))
        .status,
    ).toBe(400)
    expect(
      (await getSecao(request('/api/potencial/secao?uf=BA&codigo=39098&zona=150'))).status,
    ).toBe(400)
  })

  it('throttles a client that exceeds the window budget', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9' }
    for (let index = 0; index < 120; index += 1) {
      const response = await getSecao(
        request('/api/potencial/secao?uf=BA&codigo=39098&zona=150&secao=50', headers),
      )
      expect(response.status).toBe(200)
    }
    const throttled = await getSecao(
      request('/api/potencial/secao?uf=BA&codigo=39098&zona=150&secao=50', headers),
    )
    expect(throttled.status).toBe(429)
  })
})
