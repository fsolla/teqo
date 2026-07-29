import { describe, expect, it } from 'vitest'

import { municipalityGeographyParts } from '@/utilities/municipality/municipalityLabels'

describe('municipalityGeographyParts', () => {
  it('returns only the region for whole municipalities', () => {
    expect(
      municipalityGeographyParts({
        region: 'Chapada Diamantina',
        kind: 'municipio',
        zoneNumber: null,
      }),
    ).toEqual({ region: 'Chapada Diamantina', zoneSuffix: null })
  })

  it('keeps the ZE suffix outside the linkable region name', () => {
    expect(
      municipalityGeographyParts({
        region: 'Salvador',
        kind: 'zona',
        zoneNumber: 5,
      }),
    ).toEqual({ region: 'Salvador', zoneSuffix: '· ZE 5' })
  })
})
