// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { plazaCatalog } from '@/lib/plazaCatalog'
import { loadPlazaMapBundle } from '@/utilities/plazaMapData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

const ZONE_PLAZA_COUNT = plazaCatalog.filter((entry) => entry.kind === 'zona').length
const ZONE_MUNICIPALITY_CODES = new Set(
  plazaCatalog.filter((entry) => entry.kind === 'zona').map((entry) => entry.ibgeCode),
)

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadPlazaMapBundle — list URL filters', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('scopes the map to zone plazas when kind=zona is in the URL', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadPlazaMapBundle(payload, coordinator, { kind: 'zona' })

    expect(bundle).not.toBeNull()
    expect(bundle!.zoneBreakdown).toHaveLength(ZONE_PLAZA_COUNT)

    const ibgeCodes = Object.keys(bundle!.valuesByYear['2022'] ?? {})
    expect(ibgeCodes.length).toBeGreaterThan(0)
    for (const code of ibgeCodes) {
      expect(ZONE_MUNICIPALITY_CODES.has(code)).toBe(true)
    }
  })

  it('returns null when the filtered plaza set is empty', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadPlazaMapBundle(payload, coordinator, { q: 'zzznomatch' })

    expect(bundle).toBeNull()
  })

  it('keeps advisor access and applies URL filters on top', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(administered.id, [advisor.id])

    const included = await loadPlazaMapBundle(payload, advisor, { q: administered.name })
    expect(included).not.toBeNull()
    expect(included!.zoneBreakdown.some((row) => row.slug === administered.slug)).toBe(
      administered.kind === 'zona',
    )
    if (administered.kind !== 'zona') {
      expect(Object.keys(included!.valuesByYear['2022'] ?? {})).toEqual([administered.ibgeCode])
    }

    const excluded =
      administered.kind === 'zona'
        ? await loadPlazaMapBundle(payload, advisor, { kind: 'municipio' })
        : await loadPlazaMapBundle(payload, advisor, { kind: 'zona' })
    expect(excluded).toBeNull()
  })

  it('includes validVotesByYear for TSE years and reuses 2022 for 2026', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadPlazaMapBundle(payload, coordinator, {})

    expect(bundle).not.toBeNull()
    expect(bundle!.validVotesByYear['2014']).toBeDefined()
    expect(bundle!.validVotesByYear['2018']).toBeDefined()
    expect(bundle!.validVotesByYear['2022']).toBeDefined()
    expect(bundle!.validVotesByYear['2026']).toBe(bundle!.validVotesByYear['2022'])
  })
})
