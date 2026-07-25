// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalities } from '@/lib/bahiaTerritories'
import {
  bahiaTseCityCodes,
  municipalityForTseCityCode,
  tseCityCodeForMunicipality,
} from '@/lib/bahiaTseCityCodes'

type OfficialEvidence = {
  municipalityCount: number
  assignments: Array<{ municipality: string; code: string }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(new URL('../fixtures/bahia-tse-city-codes.official.json', import.meta.url), 'utf8'),
) as OfficialEvidence

describe('Bahia municipality name → TSE city code mapping', () => {
  it('covers all 417 Bahia municipalities with TSE CD_MUNICIPIO codes', () => {
    expect(Object.keys(bahiaTseCityCodes)).toHaveLength(417)
    expect(bahiaMunicipalities).toHaveLength(417)
    expect(new Set(Object.keys(bahiaTseCityCodes))).toHaveLength(417)
    expect(new Set(Object.values(bahiaTseCityCodes))).toHaveLength(417)

    for (const city of bahiaMunicipalities) {
      const code = bahiaTseCityCodes[city]
      expect(code, city).toBeDefined()
      expect(code).toMatch(/^\d{5}$/)
    }
  })

  it('is a bijection with the canonical bahiaMunicipalities set', () => {
    expect(
      Object.keys(bahiaTseCityCodes).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    ).toEqual([...bahiaMunicipalities].sort((left, right) => left.localeCompare(right, 'pt-BR')))
  })

  it('matches the independently downloaded official municipality→code evidence', () => {
    expect(officialEvidence.municipalityCount).toBe(417)
    expect(
      officialEvidence.assignments.map(({ municipality, code }) => ({ municipality, code })),
    ).toEqual(
      Object.entries(bahiaTseCityCodes)
        .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
        .map(([municipality, code]) => ({ municipality, code })),
    )
  })

  it('matches every official assignment by a fixed evidence checksum', () => {
    const assignmentRows = Object.entries(bahiaTseCityCodes)
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([municipality, code]) => `M\t${municipality}\t${code}\n`)
      .join('')

    expect(createHash('sha256').update(assignmentRows).digest('hex')).toBe(
      officialEvidence.evidenceSha256,
    )
  })

  it('supports bidirectional lookups and differs from IBGE codes', () => {
    expect(tseCityCodeForMunicipality('Salvador')).toBe('38490')
    expect(tseCityCodeForMunicipality('Feira de Santana')).toBe('35157')
    expect(tseCityCodeForMunicipality("Dias d'Ávila")).toBe('30872')
    expect(tseCityCodeForMunicipality('Araças')).toBe('33383')
    expect(tseCityCodeForMunicipality('Município inexistente')).toBeUndefined()
    expect(tseCityCodeForMunicipality('')).toBeUndefined()

    expect(municipalityForTseCityCode('38490')).toBe('Salvador')
    expect(municipalityForTseCityCode('35157')).toBe('Feira de Santana')
    expect(municipalityForTseCityCode('00000')).toBeUndefined()
  })
})
