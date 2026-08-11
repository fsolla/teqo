// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadPersonDetail } from '@/utilities/people/personDetail'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('C118 — detalhe da pessoa (seções por capacidade, escopo do merge da lista)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('unrestricted vê a ficha inteira: liderança + dobradinha + staff + assessorado + apoiador', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leadershipMunicipality = await fixtures.getMunicipality()
    const supporterMunicipality = await fixtures.getMunicipality()

    const mariaName = fixtures.personName('Maria de Jesus')
    const contact = await fixtures.createContact({ name: mariaName })
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Maria'),
    })
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [leadershipMunicipality],
      supportStatus: 'engajado',
    })
    await payload.update({
      collection: 'leadership',
      id: leadership.id,
      data: { advisors: [advisor.id] },
      depth: 0,
      overrideAccess: true,
    })
    const deputy = await fixtures.createStateDeputy({ contact, party: 'PCdoB' })
    await payload.update({
      collection: 'municipality',
      id: leadershipMunicipality.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    // Phone reuse folds the account into the same ficha (staff capacity).
    const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })
    const supporter = await fixtures.createSupporter({
      contact,
      municipality: supporterMunicipality,
      source: 'manual',
      voteIntention: 'certo',
    })

    const person = await loadPersonDetail(payload, coordinator, relationId(contact))
    expect(person).not.toBeNull()
    expect(person).toMatchObject({
      name: mariaName,
      party: 'PCdoB',
      leadershipID: leadership.id,
      supportStatus: 'engajado',
      deputyID: deputy.id,
    })
    expect(person?.leadershipMunicipalityIDs).toContain(leadershipMunicipality.id)
    expect(person?.deputyMunicipalityIDs).toEqual([leadershipMunicipality.id])
    expect(person?.staff.map((entry) => entry.id)).toContain(account.id)
    expect(person?.assessoradoNames).toContain(advisor.name)
    expect(person?.supporters).toEqual([
      expect.objectContaining({
        id: supporter.id,
        source: 'manual',
        municipalityID: supporterMunicipality.id,
        voteIntention: 'certo',
        hasVoteIntentionConsent: false,
      }),
    ])
  })

  it('advisor vê a pessoa com capacidade na carteira', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const contact = await fixtures.createContact({ name: fixtures.personName('Ana Lima') })
    const leadership = await fixtures.createLeadership({
      contact,
      municipalities: [municipality],
    })

    const person = await loadPersonDetail(payload, advisor, relationId(contact))
    expect(person).not.toBeNull()
    expect(person?.leadershipID).toBe(leadership.id)
  })

  it('advisor não vê a pessoa cuja única capacidade está fora da carteira', async () => {
    const fixtures = campaignFixtures()
    const outside = await fixtures.getMunicipality()
    const carteira = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(carteira, [advisor])

    const contact = await fixtures.createContact({ name: fixtures.personName('Fora da Carteira') })
    await fixtures.createLeadership({ contact, municipalities: [outside] })

    expect(await loadPersonDetail(payload, advisor, relationId(contact))).toBeNull()
  })

  it('corta o apoiador de município fora da carteira do assessor', async () => {
    const fixtures = campaignFixtures()
    const carteira = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(carteira, [advisor])

    const contact = await fixtures.createContact({ name: fixtures.personName('Apoio Misto') })
    // Dobradinha as the carteira capacity: the supporter hook forbids a
    // leadership in the same municipality, so the in-scope supporter row
    // needs a capacity that is not leadership.
    const deputy = await fixtures.createStateDeputy({ contact, party: 'PT' })
    await payload.update({
      collection: 'municipality',
      id: carteira.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    const inside = await fixtures.createSupporter({
      contact,
      municipality: carteira,
      source: 'evento',
    })
    await fixtures.createSupporter({ contact, municipality: outside, source: 'convite' })

    const person = await loadPersonDetail(payload, advisor, relationId(contact))
    expect(person).not.toBeNull()
    expect(person?.deputyID).toBe(deputy.id)
    expect(person?.supporters.map((entry) => entry.id)).toEqual([inside.id])
  })

  it('pessoa só-staff (carteira vazia) é visível a unrestricted, nunca a assessor', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const contact = await fixtures.createContact({ name: fixtures.personName('Só Assessora') })
    const account = await fixtures.createCampaignUser('advisor', { phone: contact.phone })

    const asCoordinator = await loadPersonDetail(payload, coordinator, relationId(contact))
    expect(asCoordinator).not.toBeNull()
    expect(asCoordinator?.staff.map((entry) => entry.id)).toContain(account.id)
    expect(asCoordinator?.assessoraMunicipalityIDs).toEqual([])
    expect(asCoordinator?.supportStatus).toBeNull()

    expect(await loadPersonDetail(payload, advisor, relationId(contact))).toBeNull()
  })

  it('contato sem nenhuma capacidade e leader não resolvem detalhe', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const leader = await fixtures.createCampaignUser('leader')

    const bareContact = await fixtures.createContact({ name: fixtures.personName('Contato Solto') })
    expect(await loadPersonDetail(payload, coordinator, relationId(bareContact))).toBeNull()

    const contact = await fixtures.createContact({ name: fixtures.personName('Líder de Teste') })
    await fixtures.createLeadership({ contact, municipalities: [await fixtures.getMunicipality()] })
    expect(await loadPersonDetail(payload, leader, relationId(contact))).toBeNull()
  })

  it('conta leader na ficha não acende a capacidade Assessora (filtro de papel da lista)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const contact = await fixtures.createContact({ name: fixtures.personName('Liderança Leader') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })
    // Phone reuse folds the leader account into the same ficha — but the staff
    // source contract (`role in advisor|coordinator|candidate`) must cut it.
    await fixtures.createCampaignUser('leader', { phone: contact.phone })

    const person = await loadPersonDetail(payload, coordinator, relationId(contact))
    expect(person).not.toBeNull()
    expect(person?.staff).toEqual([])
    expect(person?.assessoraMunicipalityIDs).toEqual([])
  })

  it('apoiador sem município é visível só a unrestricted (coordinator-only por access)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const contact = await fixtures.createContact({ name: fixtures.personName('Apoio Solto') })
    await fixtures.createLeadership({ contact, municipalities: [municipality] })
    const supporter = await fixtures.createSupporter({ contact, source: 'convite' })

    const asCoordinator = await loadPersonDetail(payload, coordinator, relationId(contact))
    expect(asCoordinator?.supporters.map((entry) => entry.id)).toEqual([supporter.id])

    const asAdvisor = await loadPersonDetail(payload, advisor, relationId(contact))
    expect(asAdvisor).not.toBeNull()
    expect(asAdvisor?.supporters).toEqual([])
  })
})
