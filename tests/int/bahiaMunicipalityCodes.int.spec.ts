// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  bahiaMunicipalityCodes,
  codeForMunicipality,
  municipalityForCode,
} from '@/lib/bahiaMunicipalityCodes'
import { bahiaMunicipalities } from '@/lib/bahiaTerritories'

type OfficialEvidence = {
  municipalityCount: number
  assignments: Array<{ municipality: string; code: string }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(
    new URL('../fixtures/bahia-municipality-codes.official.json', import.meta.url),
    'utf8',
  ),
) as OfficialEvidence

describe('Bahia municipality name → IBGE code mapping', () => {
  it('covers all 417 Bahia municipalities with 7-digit BA codes', () => {
    expect(Object.keys(bahiaMunicipalityCodes)).toHaveLength(417)
    expect(bahiaMunicipalities).toHaveLength(417)
    expect(new Set(Object.keys(bahiaMunicipalityCodes))).toHaveLength(417)
    expect(new Set(Object.values(bahiaMunicipalityCodes))).toHaveLength(417)

    for (const city of bahiaMunicipalities) {
      const code = bahiaMunicipalityCodes[city]
      expect(code, city).toBeDefined()
      expect(code).toMatch(/^29\d{5}$/)
    }
  })

  it('is a bijection with the canonical bahiaMunicipalities set', () => {
    expect(Object.keys(bahiaMunicipalityCodes).sort((left, right) => left.localeCompare(right, 'pt-BR'))).toEqual(
      [...bahiaMunicipalities].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    )
  })

  it('matches the independently downloaded official municipality→code evidence', () => {
    expect(officialEvidence.municipalityCount).toBe(417)
    expect(
      officialEvidence.assignments.map(({ municipality, code }) => ({ municipality, code })),
    ).toEqual(
      Object.entries(bahiaMunicipalityCodes)
        .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
        .map(([municipality, code]) => ({ municipality, code })),
    )
  })

  it('matches every official assignment by a fixed evidence checksum', () => {
    const assignmentRows = Object.entries(bahiaMunicipalityCodes)
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([municipality, code]) => `M\t${municipality}\t${code}\n`)
      .join('')

    expect(createHash('sha256').update(assignmentRows).digest('hex')).toBe(
      officialEvidence.evidenceSha256,
    )
  })

  it('supports bidirectional lookups', () => {
    expect(codeForMunicipality('Salvador')).toBe('2927408')
    expect(codeForMunicipality('Feira de Santana')).toBe('2910800')
    expect(codeForMunicipality("Dias d'Ávila")).toBe('2910057')
    expect(codeForMunicipality('Araças')).toBe('2902054')
    expect(codeForMunicipality('Município inexistente')).toBeUndefined()
    expect(codeForMunicipality('')).toBeUndefined()

    expect(municipalityForCode('2927408')).toBe('Salvador')
    expect(municipalityForCode('2910800')).toBe('Feira de Santana')
    expect(municipalityForCode('0000000')).toBeUndefined()
  })
})
