import { describe, expect, it } from 'vitest'

import {
  fetchHealthData,
  parseSidraValue,
  sidraPopulationUrl,
} from '../../scripts/lib/dossieHealthData.mjs'

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
})

describe('sidraPopulationUrl / parseSidraValue', () => {
  it('builds the SIDRA population URL for the municipality', () => {
    const url = sidraPopulationUrl('2913606')
    expect(url).toContain('/t/9514/n6/2913606/v/93/p/2022')
  })

  it('parses the SIDRA value row and tolerates a missing datum', () => {
    expect(parseSidraValue([{ V: 'Valor' }, { V: '159.923' }])).toBe(159923)
    expect(parseSidraValue([{ V: 'Valor' }])).toBeNull()
    expect(parseSidraValue(null)).toBeNull()
  })
})

describe('fetchHealthData', () => {
  it('returns the sourced population baseline', async () => {
    const fetchImpl = async () => jsonResponse([{ V: 'Valor' }, { V: '159.923' }])
    const result = await fetchHealthData({
      ibgeCode: '2913606',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date('2026-09-17T12:00:00.000Z'),
    })
    expect(result.status).toBe('ok')
    expect(result.items[0].detail).toContain('159.923')
    expect(result.items[0].sourceUrl).toContain('sidra')
  })

  it('degrades to a gap when the municipality has no IBGE code', async () => {
    const result = await fetchHealthData({ ibgeCode: null })
    expect(result.status).toBe('gap')
    expect(result.items).toEqual([])
  })

  it('degrades to a gap on a failed request', async () => {
    const fetchImpl = async () => jsonResponse({}, false, 503)
    const result = await fetchHealthData({
      ibgeCode: '2913606',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.status).toBe('gap')
    expect(result.reason).toMatch(/IBGE/)
  })
})
