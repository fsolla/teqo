// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createMunicipalityStateDeputyRecord,
  updateStateDeputyContactRecord,
  updateStateDeputyPartyRecord,
} from '@/app/(campaign)/campanha/actions/stateDeputy'
import { STATE_DEPUTY_CONFLICT_MESSAGE } from '@/lib/schemas/stateDeputy'
import config from '@/payload.config'
import { CONTACT_PHONE_CONFLICT_MESSAGE } from '@/utilities/contactPhoneInvariant'

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
    where: { 'contact.name': { equals: name } },
    depth: 1,
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
      expect((await stateDeputyByName(name))?.contact).toMatchObject({ name })
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

    expect((await stateDeputyByName(name))?.contact).toMatchObject({ name })
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
    ).rejects.toThrow(/entre 2 e 120/)
    expect(await stateDeputyIdsOf(municipality.id)).toEqual([])
  })

  it('maps a duplicate name to the safe conflict message', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const existingName = fixtures.value('Deputado')
    await fixtures.createStateDeputy({ name: existingName })

    await expect(
      createMunicipalityStateDeputyRecord(payload, coordinator, {
        municipalityId: municipality.id,
        rawName: existingName,
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
    const orphanContacts = await payload.find({
      collection: 'contact',
      where: { name: { equals: name } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(orphanContacts.totalDocs).toBe(0)
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

describe('StateDeputy contact fields (B163)', () => {
  it('updates Contact fields and party without changing the legacy slug', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Nome Original', party: 'PT' })
    const legacySlug = stateDeputy.slug
    const phone = fixtures.phone()

    await updateStateDeputyContactRecord(payload, coordinator, {
      id: stateDeputy.id,
      field: 'name',
      name: 'Nome Corrigido',
    })
    await updateStateDeputyContactRecord(payload, coordinator, {
      id: stateDeputy.id,
      field: 'email',
      email: 'corrigido@example.com',
    })
    await updateStateDeputyContactRecord(payload, coordinator, {
      id: stateDeputy.id,
      field: 'phone',
      phone,
    })
    await updateStateDeputyPartyRecord(payload, coordinator, {
      id: stateDeputy.id,
      party: 'PSD',
    })

    const updated = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(updated.slug).toBe(legacySlug)
    expect(updated.party).toBe('PSD')
    expect(updated.contact).toMatchObject({
      name: 'Nome Corrigido',
      email: 'corrigido@example.com',
      phone,
    })
  })

  it('rejects a phone already owned by another Contact', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Dobradinha Principal' })
    const takenPhone = fixtures.phone()
    await fixtures.createContact({ phone: takenPhone })

    await expect(
      updateStateDeputyContactRecord(payload, coordinator, {
        id: stateDeputy.id,
        field: 'phone',
        phone: takenPhone,
      }),
    ).rejects.toThrow(CONTACT_PHONE_CONFLICT_MESSAGE)
  })

  it('rejects renaming a dobradinha to another dobradinha name', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    await fixtures.createStateDeputy({ name: 'Nome já usado' })
    const stateDeputy = await fixtures.createStateDeputy({ name: 'Nome atual' })

    await expect(
      updateStateDeputyContactRecord(payload, coordinator, {
        id: stateDeputy.id,
        field: 'name',
        name: 'Nome já usado',
      }),
    ).rejects.toThrow(STATE_DEPUTY_CONFLICT_MESSAGE)

    const unchanged = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(unchanged.contact).toMatchObject({ name: 'Nome atual' })
  })

  it('keeps the name invariant when an admin edits the linked Contact directly', async () => {
    const fixtures = campaignFixtures()
    const first = await fixtures.createStateDeputy({ name: 'Nome já usado' })
    const second = await fixtures.createStateDeputy({ name: 'Nome atual' })
    const secondContactID = typeof second.contact === 'object' ? second.contact.id : second.contact

    await expect(
      payload.update({
        collection: 'contact',
        id: secondContactID,
        data: { name: 'Nome já usado' },
        depth: 0,
        overrideAccess: true,
      }),
    ).rejects.toThrow(STATE_DEPUTY_CONFLICT_MESSAGE)

    const unchanged = await payload.findByID({
      collection: 'contact',
      id: secondContactID,
      depth: 0,
      overrideAccess: true,
    })
    expect(unchanged.name).toBe('Nome atual')
    expect(first.id).not.toBe(second.id)
  })
})
