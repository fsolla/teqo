import { describe, expect, it } from 'vitest'

import {
  buildMunicipalityV2StatusAggregate,
  MUNICIPALITY_V2_SIGNAL_COLD_VALUE,
  resolveMunicipalityV2UpdateState,
} from '@/utilities/municipality/municipalityV2StatusView'

describe('municipalityV2StatusView', () => {
  it('uses cold sentinel when there is no recent signal', () => {
    const state = resolveMunicipalityV2UpdateState(
      { polarity: null, lastSignalAt: null },
      new Date('2026-08-02T12:00:00.000Z'),
    )
    expect(state.value).toBe(MUNICIPALITY_V2_SIGNAL_COLD_VALUE)
    expect(state.isCold).toBe(true)
    expect(state.label).toContain('Sem sinal')
  })

  it('does not claim frio when frescor is warm but typeless', () => {
    const state = resolveMunicipalityV2UpdateState(
      {
        polarity: null,
        lastSignalAt: '2026-08-01T12:00:00.000Z',
      },
      new Date('2026-08-02T12:00:00.000Z'),
    )
    expect(state.value).toBe(MUNICIPALITY_V2_SIGNAL_COLD_VALUE)
    expect(state.isCold).toBe(false)
    expect(state.label).toBe('Sem polaridade')
  })

  it('keeps the typed polarity when still warm', () => {
    const state = resolveMunicipalityV2UpdateState(
      {
        polarity: 'ruim',
        lastSignalAt: '2026-08-01T12:00:00.000Z',
      },
      new Date('2026-08-02T12:00:00.000Z'),
    )
    expect(state.value).toBe('ruim')
    expect(state.isCold).toBe(false)
    expect(state.label).toBe('Ruim')
  })

  it('builds the aggregate from the three note axes', () => {
    const aggregate = buildMunicipalityV2StatusAggregate(
      {
        engagementLevel: 'n2',
        levelNote: 'Subiu o nível',
        trendNote: 'Tendência melhor',
        updatePolarity: 'ruim',
        updateBody: 'Rede parou',
        lastSignalAt: '2026-08-01T12:00:00.000Z',
      },
      new Date('2026-08-02T12:00:00.000Z'),
    )
    expect(aggregate).toBe('Subiu o nível · Tendência melhor · Rede parou')
  })

  it('names absences when notes are empty', () => {
    const aggregate = buildMunicipalityV2StatusAggregate(
      {
        engagementLevel: 'n1',
        levelNote: null,
        trendNote: null,
        updatePolarity: null,
        updateBody: null,
        lastSignalAt: null,
      },
      new Date('2026-08-02T12:00:00.000Z'),
    )
    expect(aggregate).toContain('sem motivo')
    expect(aggregate).toContain('Tendência sem nota')
    expect(aggregate).toContain('Sem sinal')
  })
})
