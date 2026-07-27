// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { loadMunicipalityMapBundle } from '@/utilities/municipalityMapData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const zoneMunicipalities = municipalityCatalog.filter((entry) => entry.kind === 'zona')
const ZONE_MUNICIPALITY_COUNT = zoneMunicipalities.length
const ZONE_MUNICIPALITY_SLUGS = new Set(zoneMunicipalities.map((entry) => entry.slug))
const ZONE_MUNICIPALITY_CODES = new Set(zoneMunicipalities.map((entry) => entry.ibgeCode))

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

  it('paints each zone under its own map key, never pooled under the city code', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityMapBundle(payload, coordinator, { kind: 'zona' })

    expect(bundle).not.toBeNull()
    expect(bundle!.zoneBreakdown).toHaveLength(ZONE_MUNICIPALITY_COUNT)
    expect(bundle!.hasZoneMunicipalities).toBe(true)

    const mapKeys = Object.keys(bundle!.valuesByYear['2022'] ?? {})
    expect(mapKeys.length).toBeGreaterThan(0)
    for (const key of mapKeys) {
      expect(ZONE_MUNICIPALITY_SLUGS.has(key), key).toBe(true)
      expect(ZONE_MUNICIPALITY_CODES.has(key), key).toBe(false)
    }
    expect(Object.keys(bundle!.municipalitiesByMapKey).sort()).toEqual([...mapKeys].sort())

    // The zones share the city's TSE rank — the artifact ranks by codarea only.
    const ranks = bundle!.competitiveRankByYear['2022'] ?? {}
    const positions = new Set(mapKeys.map((key) => ranks[key]?.rank))
    expect(positions.size).toBe(1)
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
    // The map's provenance caveat follows the actor's scope, not the list below it.
    expect(included!.hasZoneMunicipalities).toBe(administered.kind === 'zona')
    expect(Object.keys(included!.valuesByYear['2022'] ?? {})).toEqual([
      administered.kind === 'zona' ? administered.slug : administered.ibgeCode,
    ])

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
