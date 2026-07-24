// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CAMPO_ELECTION_YEARS,
  campoPartiesForYear,
  isCampoElectionYear,
  isCampoParty,
} from '@/lib/campoParties'
import { partySpectrum } from '@/lib/electionPartySpectrum'

/**
 * Guards against `campoParties.ts` drifting into a second, unvalidated party
 * classifier: every curated "campo" party must also land in the `esquerda`
 * bucket of `electionPartySpectrum.ts` (the Bolognesi et al. expert survey).
 * The reverse is not required — see the file header for sourcing per year.
 */
describe('campoParties', () => {
  it('every curated party is in the esquerda spectrum bucket, for every year', () => {
    for (const year of CAMPO_ELECTION_YEARS) {
      for (const party of campoPartiesForYear(year)) {
        expect(partySpectrum(party)).toBe('esquerda')
      }
    }
  })

  it('covers 2014, 2018, 2022 and 2026', () => {
    expect(new Set(CAMPO_ELECTION_YEARS)).toEqual(new Set([2014, 2018, 2022, 2026]))
  })

  it('includes PT and PC do B (PCDOB) across every curated year', () => {
    for (const year of CAMPO_ELECTION_YEARS) {
      expect(isCampoParty('PT', year)).toBe(true)
      expect(isCampoParty('PC do B', year)).toBe(true)
    }
  })

  it('resolves 2022/2026 to the FE Brasil federation (PT/PC do B/PV)', () => {
    for (const year of [2022, 2026] as const) {
      expect(new Set(campoPartiesForYear(year))).toEqual(new Set(['PT', 'PCDOB', 'PV']))
    }
  })

  it('excludes opportunistic centrão allies that shared the same raw TSE coalition', () => {
    // Solla's own 2014 coalition ("MAIS MUDANÇAS, NOVAS CONQUISTAS") and 2018
    // coalition ("FRENTE DO TRABALHO POR TODA BAHIA") also included these
    // parties — deliberately excluded because they are not in the political
    // field (confirmed direita/centro in electionPartySpectrum).
    expect(isCampoParty('PP', 2014)).toBe(false)
    expect(isCampoParty('PR', 2014)).toBe(false)
    expect(isCampoParty('PSD', 2014)).toBe(false)
    expect(isCampoParty('PTB', 2014)).toBe(false)
    expect(isCampoParty('PODE', 2018)).toBe(false)
    expect(isCampoParty('PP', 2018)).toBe(false)
    expect(isCampoParty('PR', 2018)).toBe(false)
    expect(isCampoParty('PSD', 2018)).toBe(false)
  })

  it('excludes PSB from the 2022 federal field (ran its own deputado-federal slate)', () => {
    expect(isCampoParty('PSB', 2022)).toBe(false)
  })

  it('normalizes siglas and fails closed on unknown years/parties', () => {
    expect(isCampoParty('pt', 2022)).toBe(true)
    expect(isCampoParty(null, 2022)).toBe(false)
    expect(isCampoParty('PT', 2015)).toBe(false)
    expect(isCampoElectionYear(2015)).toBe(false)
    expect(campoPartiesForYear(2015)).toEqual([])
  })
})
