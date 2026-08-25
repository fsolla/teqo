// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import {
  bahiaMunicipalityDemographics,
  demographicsForCode,
  demographicsForMunicipalityName,
} from '@/lib/bahiaMunicipalityDemographics'
import { bahiaMunicipalities } from '@/lib/bahiaTerritories'

type OfficialEvidence = {
  municipalityCount: number
  assignments: Array<{
    code: string
    population: number
    ageBands: Record<'0-17' | '18-29' | '30-59' | '60+', number>
    sexShareFemale: number
    medianAge: number | null
  }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(
    new URL('../fixtures/bahia-municipality-demographics.official.json', import.meta.url),
    'utf8',
  ),
) as OfficialEvidence

describe('Bahia municipality demographics (IBGE Censo 2022)', () => {
  it('covers all 417 Bahia municipalities with positive population', () => {
    expect(Object.keys(bahiaMunicipalityDemographics)).toHaveLength(417)
    expect(bahiaMunicipalities).toHaveLength(417)
    expect(new Set(Object.keys(bahiaMunicipalityDemographics))).toHaveLength(417)

    for (const city of bahiaMunicipalities) {
      const code = bahiaMunicipalityCodes[city]
      const record = bahiaMunicipalityDemographics[code]
      expect(record, city).toBeDefined()
      expect(record.population).toBeGreaterThan(0)
      expect(
        record.ageBands['0-17'] +
          record.ageBands['18-29'] +
          record.ageBands['30-59'] +
          record.ageBands['60+'],
      ).toBe(record.population)
      expect(record.sexShareFemale).toBeGreaterThan(0)
      expect(record.sexShareFemale).toBeLessThanOrEqual(1)
    }
  })

  it('matches the independently downloaded official evidence fixture', () => {
    expect(officialEvidence.municipalityCount).toBe(417)
    expect(
      officialEvidence.assignments.map(
        ({ code, population, ageBands, sexShareFemale, medianAge }) => ({
          code,
          population,
          ageBands,
          sexShareFemale,
          medianAge,
        }),
      ),
    ).toEqual(
      Object.entries(bahiaMunicipalityDemographics)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, record]) => ({
          code,
          population: record.population,
          ageBands: record.ageBands,
          sexShareFemale: record.sexShareFemale,
          medianAge: record.medianAge,
        })),
    )
  })

  it('matches every official assignment by a fixed evidence checksum', () => {
    const assignmentRows = Object.entries(bahiaMunicipalityDemographics)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([code, record]) =>
          `D\t${code}\t${record.population}\t${record.ageBands['0-17']}\t${record.ageBands['18-29']}\t${record.ageBands['30-59']}\t${record.ageBands['60+']}\t${record.sexShareFemale}\t${record.medianAge ?? ''}\n`,
      )
      .join('')

    expect(createHash('sha256').update(assignmentRows).digest('hex')).toBe(
      officialEvidence.evidenceSha256,
    )
  })

  it('supports bidirectional lookups by municipality name', () => {
    const salvador = demographicsForMunicipalityName('Salvador')
    expect(salvador).toBeDefined()
    expect(demographicsForCode('2927408')).toEqual(salvador)
    expect(demographicsForMunicipalityName('Município inexistente')).toBeUndefined()
  })
})
