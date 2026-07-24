// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { loadMunicipalityMapBundle } from '@/utilities/municipalityMapData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const ZONE_MUNICIPALITY_COUNT = municipalityCatalog.filter((entry) => entry.kind === 'zona').length
const ZONE_MUNICIPALITY_CODES = new Set(
  municipalityCatalog.filter((entry) => entry.kind === 'zona').map((entry) => entry.ibgeCode),
)

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadMunicipalityMapBundle — list URL filters', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('scopes the map to zone municipalities when kind=zona is in the URL', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityMapBundle(payload, coordinator, { kind: 'zona' })

    expect(bundle).not.toBeNull()
    expect(bundle!.zoneBreakdown).toHaveLength(ZONE_MUNICIPALITY_COUNT)

    const ibgeCodes = Object.keys(bundle!.valuesByYear['2022'] ?? {})
    expect(ibgeCodes.length).toBeGreaterThan(0)
    for (const code of ibgeCodes) {
      expect(ZONE_MUNICIPALITY_CODES.has(code)).toBe(true)
    }
  })

  it('returns null when the filtered municipality set is empty', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityMapBundle(payload, coordinator, { q: 'zzznomatch' })

    expect(bundle).toBeNull()
  })

  it('keeps advisor access and applies URL filters on top', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const included = await loadMunicipalityMapBundle(payload, advisor, { q: administered.name })
    expect(included).not.toBeNull()
    expect(included!.zoneBreakdown.some((row) => row.slug === administered.slug)).toBe(
      administered.kind === 'zona',
    )
    if (administered.kind !== 'zona') {
      expect(Object.keys(included!.valuesByYear['2022'] ?? {})).toEqual([administered.ibgeCode])
    }

    const excluded =
      administered.kind === 'zona'
        ? await loadMunicipalityMapBundle(payload, advisor, { kind: 'municipio' })
        : await loadMunicipalityMapBundle(payload, advisor, { kind: 'zona' })
    expect(excluded).toBeNull()
  })

  it('includes validVotesByYear for TSE years and reuses 2022 for 2026', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityMapBundle(payload, coordinator, {})

    expect(bundle).not.toBeNull()
    expect(bundle!.validVotesByYear['2014']).toBeDefined()
    expect(bundle!.validVotesByYear['2018']).toBeDefined()
    expect(bundle!.validVotesByYear['2022']).toBeDefined()
    expect(bundle!.validVotesByYear['2026']).toBe(bundle!.validVotesByYear['2022'])
  })
})
