// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createMunicipalityStateDeputyRecord } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { STATE_DEPUTY_CONFLICT_MESSAGE } from '@/lib/schemas/stateDeputy'
import config from '@/payload.config'

import { installCampaignFixtures, relationIds } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const stateDeputyIdsOf = async (municipalityID: number): Promise<number[]> => {
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { stateDeputies: true },
    overrideAccess: true,
  })
  return relationIds(municipality.stateDeputies)
}

const stateDeputyByName = async (name: string) => {
  const result = await payload.find({
    collection: 'stateDeputy',
    where: { name: { equals: name } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return result.docs[0]
}

describe('createMunicipalityStateDeputyRecord (B157)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['coordinator', 'candidate'] as const)(
    'lets a %s create a dobradinha and link it to the município in one write',
    async (role) => {
      const fixtures = campaignFixtures()
      const actor = await fixtures.createCampaignUser(role)
      const municipality = await fixtures.getMunicipality()
      const name = fixtures.value('Cicrano')

      const { stateDeputy, municipalitySlug } = await createMunicipalityStateDeputyRecord(
        payload,
        actor,
        { municipalityId: municipality.id, rawName: name },
      )
      fixtures.touchMunicipality(municipality.id)

      expect(municipalitySlug).toBe(municipality.slug)
      expect(stateDeputy.name).toBe(name)
      expect(stateDeputy.party).toBeNull()
      expect(await stateDeputyIdsOf(municipality.id)).toEqual([stateDeputy.id])
    },
  )

  it('parses a trailing (PARTIDO) group and persists the party', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const name = fixtures.value('Cicrano')
    const party = fixtures
      .value('PCdoB')
      .replace(/-\w+-\d+$/, '')
      .slice(0, 32)

    const { stateDeputy } = await createMunicipalityStateDeputyRecord(payload, coordinator, {
      municipalityId: municipality.id,
      rawName: `${name} (${party})`,
    })
    fixtures.touchMunicipality(municipality.id)

    expect(stateDeputy.name).toBe(name)
    expect(stateDeputy.party).toBe(party)
    expect((await stateDeputyByName(name))?.party).toBe(party)
  })

  it('refuses a name that only parses to a party group', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await expect(
      createMunicipalityStateDeputyRecord(payload, coordinator, {
        municipalityId: municipality.id,
        rawName: '(PT)',
      }),
    ).rejects.toThrow(/entre 2 e 160/)
    expect(await stateDeputyIdsOf(municipality.id)).toEqual([])
  })

  it('maps a duplicate name to the safe conflict message', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const existing = await fixtures.createStateDeputy()

    await expect(
      createMunicipalityStateDeputyRecord(payload, coordinator, {
        municipalityId: municipality.id,
        rawName: existing.name,
      }),
    ).rejects.toThrow(STATE_DEPUTY_CONFLICT_MESSAGE)
    expect(await stateDeputyIdsOf(municipality.id)).toEqual([])
  })

  it('rolls the create back when the assign is out of the actor scope', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const outside = await fixtures.getMunicipality()
    const name = fixtures.value('Fora do escopo')

    await expect(
      createMunicipalityStateDeputyRecord(payload, advisor, {
        municipalityId: outside.id,
        rawName: name,
      }),
    ).rejects.toThrow()

    // The create must roll back with the failed assign — no orphan deputy.
    expect(await stateDeputyByName(name)).toBeUndefined()
    expect(await stateDeputyIdsOf(outside.id)).toEqual([])
  })

  it('denies a leader actor', async () => {
    const fixtures = campaignFixtures()
    const leaderActor = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const name = fixtures.value('Só staff')

    await expect(
      createMunicipalityStateDeputyRecord(payload, leaderActor, {
        municipalityId: municipality.id,
        rawName: name,
      }),
    ).rejects.toThrow(/coordenação e a assessoria/i)
    expect(await stateDeputyByName(name)).toBeUndefined()
  })

  it('serializes concurrent creates on the same município through the advisory lock', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const [first, second] = await Promise.all([
      createMunicipalityStateDeputyRecord(payload, coordinator, {
        municipalityId: municipality.id,
        rawName: fixtures.value('Primeiro'),
      }),
      createMunicipalityStateDeputyRecord(payload, coordinator, {
        municipalityId: municipality.id,
        rawName: fixtures.value('Segundo'),
      }),
    ])
    fixtures.touchMunicipality(municipality.id)

    expect((await stateDeputyIdsOf(municipality.id)).sort((a, b) => a - b)).toEqual(
      [first.stateDeputy.id, second.stateDeputy.id].sort((a, b) => a - b),
    )
  })
})
