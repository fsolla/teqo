// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import {
  loadPeopleListPageData,
  type PeopleListFilterFacets,
  type PeopleRowViewModel,
} from '@/utilities/people/peopleData'
import { peoplePageSize, type PeopleListState } from '@/utilities/people/peopleListUrl'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/**
 * OPS45 — the people list is GLOBAL and paginated (25 rows/page, sorted by
 * name): residue from crashed runs and rows of parallel spec files legitimately
 * occupy the first pages, so a presence assertion over page 1 alone is
 * state-sensitive. Collect every page until one comes back short — a short
 * page means the sweep is complete, and the bound self-heals when parallel
 * files grow the list between fetches. Rows are deduped by contactID (a row
 * that crosses a page boundary mid-sweep would otherwise appear twice, which
 * would break count assertions). Facets come from page 1 (they are computed
 * over the whole scoped set before pagination, so they are already global).
 */
const loadAllPeopleRows = async (
  listPayload: Payload,
  user: CampaignUser,
  state: PeopleListState,
): Promise<{ rows: PeopleRowViewModel[]; filterFacets: PeopleListFilterFacets }> => {
  const byContact = new Map<number, PeopleRowViewModel>()
  let filterFacets: PeopleListFilterFacets | undefined
  for (let page = 1; ; page += 1) {
    const result = await loadPeopleListPageData(listPayload, user, { ...state, page })
    filterFacets ??= result.filterFacets
    for (const row of result.rows) {
      if (!byContact.has(row.contactID)) byContact.set(row.contactID, row)
    }
    if (result.rows.length < peoplePageSize) break
  }
  return {
    rows: [...byContact.values()],
    filterFacets: filterFacets ?? { municipalityIDs: [], statuses: [], parties: [] },
  }
}

describe('C100 — lista unificada de pessoas (merge por Contact)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('merges leadership, dobradinha and staff rows into one row per ficha', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const mariaName = fixtures.personName('Maria de Jesus')
    const leadershipContact = await fixtures.createContact({ name: mariaName })
    const leadership = await fixtures.createLeadership({
      contact: leadershipContact,
      municipalities: [municipality],
    })

    const anaName = fixtures.personName('Ana Lima')
    const deputyContact = await fixtures.createContact({ name: anaName })
    const deputy = await fixtures.createStateDeputy({ contact: deputyContact, party: 'PCdoB' })

    const advisor = await fixtures.createCampaignUser('advisor')
    const pureContact = await fixtures.createContact({ name: fixtures.personName('Só Ficha') })

    const { rows, filterFacets } = await loadAllPeopleRows(payload, coordinator, { page: 1 })

    const maria = rows.find((row) => row.contactID === relationId(leadershipContact))
    expect(maria).toMatchObject({
      name: mariaName,
      leadershipID: leadership.id,
      supportStatus: 'engajado',
    })
    expect(maria?.leadershipMunicipalityIDs).toContain(municipality.id)

    const ana = rows.find((row) => row.contactID === relationId(deputyContact))
    expect(ana).toMatchObject({ name: anaName, deputyID: deputy.id, party: 'PCdoB' })

    // Staff with a ficha enters even with an EMPTY carteira (gate 2026-08-09).
    const advisorRow = rows.find((row) => row.contactID === relationId(advisor.contact))
    expect(advisorRow?.staff.map((account) => account.id)).toContain(advisor.id)
    expect(advisorRow?.assessoraMunicipalityIDs).toEqual([])

    // A bare Contact with no role never enters.
    expect(rows.some((row) => row.contactID === relationId(pureContact))).toBe(false)
    expect(filterFacets.municipalityIDs).toContain(municipality.id)
    expect(filterFacets.statuses).toContain('engajado')
  })

  it('merges an account sharing the ficha (phone reuse) into the leadership row', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('Dupla Função') })
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })
    const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
    expect(relationId(account.contact)).toBe(contact.id)

    const { rows } = await loadAllPeopleRows(payload, coordinator, { page: 1 })
    const mergedRows = rows.filter((row) => row.contactID === contact.id)

    expect(mergedRows).toHaveLength(1)
    expect(mergedRows[0]?.leadershipID).toBe(leadership.id)
    expect(mergedRows[0]?.staff.some((staff) => staff.id === account.id)).toBe(true)
  })

  it('scopes every source to the advisor carteira', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const stranger = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor])

    const ownContact = await fixtures.createContact({
      name: fixtures.personName('Própria Liderança'),
    })
    await fixtures.createLeadership({ contact: ownContact, municipalities: [administered] })
    const alienContact = await fixtures.createContact({
      name: fixtures.personName('Liderança Alheia'),
    })
    await fixtures.createLeadership({ contact: alienContact, municipalities: [stranger] })

    const deputyContact = await fixtures.createContact({
      name: fixtures.personName('Aliada Local'),
    })
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

    const { rows } = await loadAllPeopleRows(payload, advisor, { page: 1 })
    const contactIDs = rows.map((row) => row.contactID)

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
    const mariaName = fixtures.personName('Maria de Jesus')
    const maria = await fixtures.createContact({ name: mariaName })
    await fixtures.createLeadership({ contact: maria, municipalities: [municipality] })
    const joao = await fixtures.createContact({ name: fixtures.personName('João do Brejo') })
    await fixtures.createLeadership({ contact: joao, municipalities: [municipality] })

    const { rows } = await loadAllPeopleRows(payload, coordinator, { page: 1, q: 'Maria' })
    const names = rows.map((row) => row.name)

    expect(names).toContain(mariaName)
    expect(names).not.toContain(joao.name)
  })

  it('filters by party and exposes the party facet from the recorte (C130)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const deputyContact = await fixtures.createContact({
      name: fixtures.personName('Deputada do Partido'),
    })
    await fixtures.createStateDeputy({ contact: deputyContact, party: 'PSOL' })
    const noDeputyContact = await fixtures.createContact({
      name: fixtures.personName('Sem Dobradinha'),
    })
    await fixtures.createLeadership({ contact: noDeputyContact, municipalities: [municipality] })

    const all = await loadAllPeopleRows(payload, coordinator, { page: 1 })
    expect(all.filterFacets.parties).toContain('PSOL')

    const filtered = await loadAllPeopleRows(payload, coordinator, {
      page: 1,
      parties: ['PSOL'],
    })
    expect(filtered.rows.map((row) => row.contactID)).toContain(relationId(deputyContact))
    expect(filtered.rows.some((row) => row.contactID === relationId(noDeputyContact))).toBe(false)
  })

  it('returns empty data for a leader (lockdown)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact({ name: fixtures.personName('Alguém') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })

    const result = await loadPeopleListPageData(payload, leader, { page: 1 })

    expect(result.rows).toEqual([])
    expect(result.totalDocs).toBe(0)
    expect(result.totalPages).toBe(0)
  })
})
