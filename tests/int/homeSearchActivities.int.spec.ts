// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createActivityRecord } from '@/app/(campaign)/campanha/actions/activity'
import config from '@/payload.config'
import { searchHomeActivities } from '@/utilities/homeSearch/searchHomeActivities'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const validActivityInput = (municipalityId: number, title: string) => ({
  title,
  kind: 'caminhada' as const,
  status: 'planejado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  municipality: municipalityId,
  locality: 'Centro',
})

describe('searchHomeActivities (B51)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns empty hits when query is shorter than the minimum', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await searchHomeActivities(payload, coordinator, 'a')
    expect(result).toEqual([])
  })

  it('matches activities by word-start on the title for staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality('cairu')
    const title = fixtures.value('Caminhada Zeca Centro')
    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipality.id, title),
    )
    fixtures.own('activity', activity.id)

    const result = await searchHomeActivities(payload, coordinator, 'Caminhada')
    const hit = result.find((row) => row.id === activity.id)
    expect(hit?.title).toBe(title)
    expect(hit?.slug).toBe(activity.slug)
    expect(hit?.secondary).toContain('Cairu')
  })

  it('does not match mid-word without word-start boundary', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality('cairu')
    const title = fixtures.value('Feira Comunitária')
    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipality.id, title),
    )
    fixtures.own('activity', activity.id)

    const result = await searchHomeActivities(payload, coordinator, 'eira')
    expect(result.some((row) => row.id === activity.id)).toBe(false)
  })

  it('scopes activity hits to the advisor portfolio by municipality', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const administered = await fixtures.getMunicipality('cairu')
    const other = await fixtures.getMunicipality('feira-de-santana')
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const scopeToken = fixtures.value('scope-atividade')
    const inScope = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(administered.id, `Caminhada ${scopeToken} Cairu`),
    )
    fixtures.own('activity', inScope.id)

    const outOfScope = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(other.id, `Caminhada ${scopeToken} Feira`),
    )
    fixtures.own('activity', outOfScope.id)

    const advisorResult = await searchHomeActivities(payload, advisor, scopeToken)
    expect(advisorResult.map((hit) => hit.id)).toEqual([inScope.id])

    const coordinatorResult = await searchHomeActivities(payload, coordinator, scopeToken)
    expect(coordinatorResult.map((hit) => hit.id).sort((a, b) => a - b)).toEqual(
      [inScope.id, outOfScope.id].sort((a, b) => a - b),
    )
  })

  it('includes drafts without startAt with Data a definir secondary', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality('cairu')
    const title = fixtures.value('Rascunho sem data')
    const activity = await createActivityRecord(payload, coordinator, {
      title,
      kind: 'caminhada',
      status: 'rascunho',
      municipality: municipality.id,
    })
    fixtures.own('activity', activity.id)

    const result = await searchHomeActivities(payload, coordinator, 'Rascunho')
    const hit = result.find((row) => row.id === activity.id)
    expect(hit?.secondary).toContain('Data a definir')
    expect(hit?.secondary).toContain('Cairu')
  })

  it('rejects leaders from home search', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(searchHomeActivities(payload, leader, 'Caminhada')).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
