// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  bahiaMunicipalities,
  bahiaIdentityTerritoryRecords,
  citiesForTerritory,
  isBahiaMunicipality,
  territoryForCity,
  validateBahiaTerritoryPair,
} from '@/lib/bahiaTerritories'
import { nucleusCreateSchema, nucleusUpdateSchema } from '@/lib/schemas/nucleus'

type OfficialEvidence = {
  territories: Array<{ code: string; name: string; municipalityCount: number }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(
    new URL('../fixtures/bahia-identity-territories.official.json', import.meta.url),
    'utf8',
  ),
) as OfficialEvidence

describe('Bahia identity territory mapping', () => {
  it('contains 27 territories and 417 unique municipalities', () => {
    expect(bahiaIdentityTerritoryRecords).toHaveLength(27)
    expect(bahiaMunicipalities).toHaveLength(417)
    expect(new Set(bahiaMunicipalities)).toHaveLength(417)
  })

  it('matches the independently downloaded official territory metadata', () => {
    expect(
      bahiaIdentityTerritoryRecords.map(({ code, name, municipalityCount }) => ({
        code,
        name,
        municipalityCount,
      })),
    ).toEqual(officialEvidence.territories)
  })

  it('matches every official municipality assignment by a fixed evidence checksum', () => {
    const territoryRows = bahiaIdentityTerritoryRecords
      .map(
        ({ code, name, municipalityCount }) =>
          `T\t${code}\t${name}\t${municipalityCount}\n`,
      )
      .join('')
    const assignmentRows = bahiaIdentityTerritoryRecords
      .flatMap(({ code, municipalities }) =>
        municipalities.map((municipality) => ({ municipality, code })),
      )
      .sort((left, right) =>
        left.municipality < right.municipality
          ? -1
          : left.municipality > right.municipality
            ? 1
            : 0,
      )
      .map(({ municipality, code }) => `M\t${municipality}\t${code}\n`)
      .join('')

    expect(createHash('sha256').update(territoryRows + assignmentRows).digest('hex')).toBe(
      officialEvidence.evidenceSha256,
    )
  })

  it('supports representative bidirectional lookups', () => {
    expect(territoryForCity('Salvador')).toBe('Metropolitano de Salvador')
    expect(territoryForCity('Seabra')).toBe('Chapada Diamantina')
    expect(territoryForCity('Juazeiro')).toBe('Sertão do São Francisco')
    expect(territoryForCity('Vitória da Conquista')).toBe('Sudoeste Baiano')
    expect(territoryForCity('Município inexistente')).toBeUndefined()

    expect(citiesForTerritory('Costa do Descobrimento')).toContain('Porto Seguro')
    expect(citiesForTerritory('Itaparica')).toEqual([
      'Abaré',
      'Chorrochó',
      'Glória',
      'Macururé',
      'Paulo Afonso',
      'Rodelas',
    ])
    expect(isBahiaMunicipality('Salvador')).toBe(true)
    expect(isBahiaMunicipality('Município inexistente')).toBe(false)
    expect(validateBahiaTerritoryPair('Metropolitano de Salvador', 'Salvador')).toBe(true)
    expect(validateBahiaTerritoryPair('Chapada Diamantina', 'Salvador')).toBe(false)
  })

  it('rejects mismatched territory and municipality pairs on the server', () => {
    const mismatched = {
      name: 'Núcleo incompatível',
      region: 'Chapada Diamantina',
      city: 'Salvador',
      organizationKind: 'territorial',
    } as const

    expect(() => nucleusCreateSchema.parse(mismatched)).toThrow(
      'município não pertence ao território',
    )
    expect(() => nucleusUpdateSchema.parse({ id: 1, ...mismatched })).toThrow(
      'município não pertence ao território',
    )
  })
})
