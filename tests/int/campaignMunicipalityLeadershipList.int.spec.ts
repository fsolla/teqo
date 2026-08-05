// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createLeadershipRecord,
  createMunicipalityLeadershipRecord,
} from '@/app/(campaign)/campanha/actions/leadership'
import { relationshipId } from '@/lib/relationship'
import config from '@/payload.config'
import { loadMunicipalityListPageBundle } from '@/utilities/municipality/municipalityPageData'
import {
  getEligibleLeadershipOptions,
  loadMunicipalityLeadershipSummaries,
} from '@/utilities/municipality/municipalityViewModels'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('B155 — lideranças na lista de municípios (leitura reversa + opções)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('summarizes the leaderships of the given municípios with contact names', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    const contactA = await fixtures.createContact({ name: 'Maria de Jesus' })
    const leadershipA = await fixtures.createLeadership({
      contact: contactA,
      municipalities: [first],
    })
    const contactB = await fixtures.createContact({ name: 'João do Brejo' })
    const leadershipB = await fixtures.createLeadership({
      contact: contactB,
      municipalities: [first, second],
    })

    const { leadershipIDsByMunicipality, summariesById } =
      await loadMunicipalityLeadershipSummaries(payload, coordinator, [first.id, second.id])

    expect([...summariesById.keys()].sort()).toEqual([leadershipA.id, leadershipB.id].sort())
    expect(summariesById.get(leadershipA.id)?.name).toBe('Maria de Jesus')
    expect(summariesById.get(leadershipB.id)?.name).toBe('João do Brejo')
    expect(leadershipIDsByMunicipality.get(first.id)?.sort()).toEqual(
      [leadershipA.id, leadershipB.id].sort(),
    )
    expect(leadershipIDsByMunicipality.get(second.id)).toEqual([leadershipB.id])
  })

  it('returns empty maps for an empty id list', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const { leadershipIDsByMunicipality, summariesById } =
      await loadMunicipalityLeadershipSummaries(payload, coordinator, [])

    expect(leadershipIDsByMunicipality.size).toBe(0)
    expect(summariesById.size).toBe(0)
  })

  it('scopes the summaries and options to an advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const stranger = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor])

    const ownContact = await fixtures.createContact({ name: 'Própria' })
    const own = await fixtures.createLeadership({
      contact: ownContact,
      municipalities: [administered],
    })
    const alienContact = await fixtures.createContact({ name: 'Alheia' })
    const alien = await fixtures.createLeadership({
      contact: alienContact,
      municipalities: [stranger],
    })

    const { summariesById } = await loadMunicipalityLeadershipSummaries(payload, advisor, [
      administered.id,
      stranger.id,
    ])
    expect(summariesById.has(own.id)).toBe(true)
    expect(summariesById.has(alien.id)).toBe(false)

    const options = await getEligibleLeadershipOptions(payload, advisor)
    expect(options.map((option) => option.id)).toContain(own.id)
    expect(options.map((option) => option.id)).not.toContain(alien.id)
  })

  it('lists every leadership for unrestricted staff and names them by contact', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: 'Fulana dos Anjos' })
    const leadership = await fixtures.createLeadership({ contact, municipalities: [municipality] })

    const options = await getEligibleLeadershipOptions(payload, coordinator)
    const found = options.find((option) => option.id === leadership.id)

    expect(found).toMatchObject({ id: leadership.id, name: 'Fulana dos Anjos' })
  })

  it('carries leadershipIDs and names in the list page bundle for staff only', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: 'Chica da Roça' })
    const leadership = await fixtures.createLeadership({ contact, municipalities: [municipality] })

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      slug: municipality.slug,
    })
    const row = bundle.municipalities.find((item) => item.id === municipality.id)

    expect(row?.leadershipIDs).toContain(leadership.id)
    expect(bundle.leadershipNamesById.get(leadership.id)?.name).toBe('Chica da Roça')

    const leader = await fixtures.createCampaignUser('leader')
    const leaderBundle = await loadMunicipalityListPageBundle(payload, leader, {})
    expect(leaderBundle.municipalities).toEqual([])
    expect(leaderBundle.leadershipNamesById.size).toBe(0)
  })

  it('creates an inline leadership with name only and exposes it through the column read', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const created = await createMunicipalityLeadershipRecord(payload, coordinator, {
      municipalityId: municipality.id,
      name: 'Criada na Reunião',
    })

    const contactID = relationshipId(created.leadership.contact)
    if (contactID === null) throw new Error('A liderança criada deve referenciar um contato.')
    const contact = await payload.findByID({
      collection: 'contact',
      id: contactID,
      depth: 0,
      overrideAccess: true,
    })
    expect(contact.phone).toBeNull()

    const { leadershipIDsByMunicipality, summariesById } =
      await loadMunicipalityLeadershipSummaries(payload, coordinator, [municipality.id])

    expect(leadershipIDsByMunicipality.get(municipality.id)).toContain(created.leadership.id)
    expect(summariesById.get(created.leadership.id)?.name).toBe('Criada na Reunião')
  })

  it('keeps phone dedup on the complete leadership create path', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const phone = fixtures.phone()

    const first = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Nome Original',
      phone,
    })
    await expect(
      createLeadershipRecord(payload, coordinator, {
        municipalities: [municipality.id],
        name: 'Outro Nome',
        phone,
      }),
    ).rejects.toThrow('Esta pessoa já está cadastrada como liderança')

    expect(first.contactReused).toBe(false)
  })
})
