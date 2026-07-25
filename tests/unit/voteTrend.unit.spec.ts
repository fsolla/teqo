// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { formatElectionNumber } from '@/lib/electionFormat'
import { computeVoteTrend } from '@/lib/voteTrend'

describe('formatElectionNumber', () => {
  it('formats whole votes with pt-BR thousands separators', () => {
    expect(formatElectionNumber(150_000)).toBe('150.000')
  })

  it('never renders decimals — a fractional goal must not read as thousands (E18 defect)', () => {
    expect(formatElectionNumber(100.968)).toBe('101')
  })
})

describe('computeVoteTrend', () => {
  it('classifies increase when the latest step exceeds 10%', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1200, y2022: 1400 })).toMatchObject({
      status: 'increase',
      ratio: 1400 / 1200,
    })
  })

  it('classifies decline when the latest step drops more than 10%', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1200, y2022: 1000 })).toMatchObject({
      status: 'decline',
      ratio: 1000 / 1200,
    })
  })

  it('classifies stable within the ±10% band on the preferred 2018→2022 pair', () => {
    expect(computeVoteTrend({ y2014: 500, y2018: 1000, y2022: 1050 })).toMatchObject({
      status: 'stable',
      ratio: 1.05,
    })
  })

  it('falls back to 2014→2018 when 2022 is missing', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1500, y2022: 0 })).toMatchObject({
      status: 'increase',
    })
  })

  it('reports noBaseline with fewer than two non-zero years', () => {
    expect(computeVoteTrend({ y2014: 0, y2018: 0, y2022: 500 }).status).toBe('noBaseline')
  })
})
