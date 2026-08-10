// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadPeopleListPageData } from '@/utilities/people/peopleData'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('C100 — lista unificada de pessoas (merge por Contact)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('merges leadership, dobradinha and staff rows into one row per ficha', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const leadershipContact = await fixtures.createContact({ name: 'Maria de Jesus' })
    const leadership = await fixtures.createLeadership({
      contact: leadershipContact,
      municipalities: [municipality],
    })

    const deputyContact = await fixtures.createContact({ name: 'Ana Lima' })
    const deputy = await fixtures.createStateDeputy({ contact: deputyContact, party: 'PCdoB' })

    const advisor = await fixtures.createCampaignUser('advisor')
    const pureContact = await fixtures.createContact({ name: 'Só Ficha' })

    const result = await loadPeopleListPageData(payload, coordinator, { page: 1 })

    const maria = result.rows.find((row) => row.contactID === relationId(leadershipContact))
    expect(maria).toMatchObject({
      name: 'Maria de Jesus',
      leadershipID: leadership.id,
      supportStatus: 'engajado',
    })
    expect(maria?.leadershipMunicipalityIDs).toContain(municipality.id)

    const ana = result.rows.find((row) => row.contactID === relationId(deputyContact))
    expect(ana).toMatchObject({ name: 'Ana Lima', deputyID: deputy.id, party: 'PCdoB' })

    // Staff with a ficha enters even with an EMPTY carteira (gate 2026-08-09).
    const advisorRow = result.rows.find((row) => row.contactID === relationId(advisor.contact))
    expect(advisorRow?.staff.map((account) => account.id)).toContain(advisor.id)
    expect(advisorRow?.assessoraMunicipalityIDs).toEqual([])

    // A bare Contact with no role never enters.
    expect(result.rows.some((row) => row.contactID === relationId(pureContact))).toBe(false)
    expect(result.filterFacets.municipalityIDs).toContain(municipality.id)
    expect(result.filterFacets.statuses).toContain('engajado')
  })

  it('merges an account sharing the ficha (phone reuse) into the leadership row', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: 'Dupla Função' })
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })
    const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
    expect(relationId(account.contact)).toBe(contact.id)

    const result = await loadPeopleListPageData(payload, coordinator, { page: 1 })
    const rows = result.rows.filter((row) => row.contactID === contact.id)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.leadershipID).toBe(leadership.id)
    expect(rows[0]?.staff.some((staff) => staff.id === account.id)).toBe(true)
  })

  it('scopes every source to the advisor carteira', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const stranger = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor])

    const ownContact = await fixtures.createContact({ name: 'Própria Liderança' })
    await fixtures.createLeadership({ contact: ownContact, municipalities: [administered] })
    const alienContact = await fixtures.createContact({ name: 'Liderança Alheia' })
    await fixtures.createLeadership({ contact: alienContact, municipalities: [stranger] })

    const deputyContact = await fixtures.createContact({ name: 'Aliada Local' })
    const deputy = await fixtures.createStateDeputy({ contact: deputyContact, party: 'PT' })
    fixtures.touchMunicipality(administered)
    await payload.update({
      collection: 'municipality',
      id: administered.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
    })

    const colleague = await fixtures.createCampaignUser('advisor')
    const unassigned = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(administered, [advisor, colleague])

    const result = await loadPeopleListPageData(payload, advisor, { page: 1 })
    const contactIDs = result.rows.map((row) => row.contactID)

    expect(contactIDs).toContain(relationId(ownContact))
    expect(contactIDs).not.toContain(relationId(alienContact))
    expect(contactIDs).toContain(relationId(deputyContact))
    expect(contactIDs).toContain(relationId(colleague.contact))
    // The advisor himself has a carteira in the portfolio — he sees himself.
    expect(contactIDs).toContain(relationId(advisor.contact))
    // A staff account with an EMPTY carteira is outside every portfolio.
    expect(contactIDs).not.toContain(relationId(unassigned.contact))
  })

  it('searches by name across the sources', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const maria = await fixtures.createContact({ name: 'Maria de Jesus' })
    await fixtures.createLeadership({ contact: maria, municipalities: [municipality] })
    const joao = await fixtures.createContact({ name: 'João do Brejo' })
    await fixtures.createLeadership({ contact: joao, municipalities: [municipality] })

    const result = await loadPeopleListPageData(payload, coordinator, { page: 1, q: 'Maria' })
    const names = result.rows.map((row) => row.name)

    expect(names).toContain('Maria de Jesus')
    expect(names).not.toContain('João do Brejo')
  })

  it('returns empty data for a leader (lockdown)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: 'Alguém' })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })

    const result = await loadPeopleListPageData(payload, leader, { page: 1 })

    expect(result.rows).toEqual([])
    expect(result.totalDocs).toBe(0)
    expect(result.totalPages).toBe(0)
  })
})
