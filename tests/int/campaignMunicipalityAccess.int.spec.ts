// @vitest-environment node

import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  assignMunicipalityAdvisorsRecord,
  setMunicipalityExpectedVotesRecord,
  setMunicipalityPoliticalTrendRecord,
  updateMunicipalityStrategyRecord,
} from '@/app/(campaign)/campanha/actions/municipality'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { getAccessibleMunicipalityIds } from '@/utilities/campaignAccess'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('municipality catalog seed and per-role access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('has all 435 predefined municipalities seeded by the migration', async () => {
    const total = await payload.count({ collection: 'municipality', where: {} })
    expect(total.totalDocs).toBe(municipalityCatalog.length)
    expect(total.totalDocs).toBe(435)

    const salvadorZones = await payload.count({
      collection: 'municipality',
      where: { and: [{ city: { equals: 'Salvador' } }, { kind: { equals: 'zona' } }] },
    })
    expect(salvadorZones.totalDocs).toBe(19)
  })

  it('gives the coordinator unrestricted municipality reads', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const result = await payload.count({
      collection: 'municipality',
      where: {},
      user: coordinator,
      overrideAccess: false,
    })
    expect(result.totalDocs).toBe(435)
  })

  it('gives the candidate unrestricted municipality reads', async () => {
    const candidate = await campaignFixtures().createCampaignUser('candidate')
    const result = await payload.count({
      collection: 'municipality',
      where: {},
      user: candidate,
      overrideAccess: false,
    })
    expect(result.totalDocs).toBe(435)
  })

  it('scopes an advisor to the municipalities they administer — including the map scope helper', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const visible = await payload.find({
      collection: 'municipality',
      where: {},
      depth: 0,
      pagination: false,
      select: { name: true },
      user: advisor,
      overrideAccess: false,
    })
    expect(visible.docs.map((municipality) => municipality.id)).toEqual([administered.id])
  })

  it('denies leaders read access to municipalities (lockdown)', async () => {
    const fixtures = campaignFixtures()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const linked = await fixtures.getMunicipality()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [linked.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    await expect(
      payload.count({
        collection: 'municipality',
        where: {},
        user: account,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('still exposes linked municipality IDs to leaders for supporter registration scope', async () => {
    const fixtures = campaignFixtures()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const linked = await fixtures.getMunicipality()
    const otherLinked = await fixtures.getMunicipality()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [linked.id, otherLinked.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    const visible = await getAccessibleMunicipalityIds(
      stub<PayloadRequest>({ payload, user: account, context: {} }),
      account,
    )
    expect(visible?.sort((a, b) => a - b)).toEqual(
      [linked.id, otherLinked.id].sort((a, b) => a - b),
    )
  })

  it('clears leader municipality scope when the leadership is no longer engaged', async () => {
    const fixtures = campaignFixtures()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const linked = await fixtures.getMunicipality()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [linked.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    await payload.update({
      collection: 'leadership',
      id: leadership.id,
      data: { supportStatus: 'em_disputa' },
      depth: 0,
    })

    const scope = await getAccessibleMunicipalityIds(
      stub<PayloadRequest>({ payload, user: account, context: {} }),
      account,
    )
    expect(scope).toEqual([])
  })

  it('blocks leaders from reading municipality strategy fields', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const municipality = await fixtures.getMunicipality()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    await updateMunicipalityStrategyRecord(payload, coordinator, {
      municipality: municipality.id,
      priority: 'alta',
      strengths: ['Base sindical forte'],
      dobradinhaNotes: 'Negociação com deputado estadual em curso.',
    })
    await setMunicipalityPoliticalTrendRecord(payload, coordinator, {
      municipality: municipality.id,
      status: 'desfavoravel',
      note: 'Prefeito rompeu com a chapa.',
    })
    await setMunicipalityExpectedVotesRecord(payload, coordinator, {
      municipality: municipality.id,
      expectedVotes: { pessimistic: null, central: 1200, optimistic: null },
    })
    fixtures.touchMunicipality(municipality.id)

    await expect(
      payload.findByID({
        collection: 'municipality',
        id: municipality.id,
        depth: 0,
        user: account,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const staffRead = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })
    expect(staffRead.priority).toBe('alta')
    expect(staffRead.expectedVotes?.central).toBe(1200)
    expect(staffRead.politicalTrend?.status).toBe('desfavoravel')
    expect(staffRead.politicalTrend?.recordedBy).toBeTruthy()
    expect(staffRead.politicalTrend?.recordedAt).toBeTruthy()
  })

  it('lets an advisor edit strategy only on administered municipalities', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const updated = await updateMunicipalityStrategyRecord(payload, advisor, {
      municipality: administered.id,
      priority: 'alta',
      nextSteps: 'Agendar reunião com a executiva municipal.',
      budgetNotes: 'Emenda de R$ 2 mi para saúde (2025) empenhada.',
    })
    expect(updated.priority).toBe('alta')
    expect(updated.nextSteps).toBe('Agendar reunião com a executiva municipal.')
    expect(updated.budgetNotes).toBe('Emenda de R$ 2 mi para saúde (2025) empenhada.')
    fixtures.touchMunicipality(administered.id)

    await expect(
      updateMunicipalityStrategyRecord(payload, advisor, {
        municipality: outside.id,
        priority: 'alta',
      }),
    ).rejects.toThrow()
  })

  it('restricts advisor assignment to the coordinator and validates roles', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()

    await expect(
      assignMunicipalityAdvisorsRecord(payload, advisor, {
        municipality: municipality.id,
        advisors: [advisor.id],
      }),
    ).rejects.toThrow('Coordenador Geral')

    await expect(
      assignMunicipalityAdvisorsRecord(payload, coordinator, {
        municipality: municipality.id,
        advisors: [leaderAccount.id],
      }),
    ).rejects.toThrow()

    // The candidate is eligible: the projection sheet lists him as responsible
    // for some municipalities (decision 2026-07-24).
    const candidate = await fixtures.createCampaignUser('candidate')
    const assigned = await assignMunicipalityAdvisorsRecord(payload, coordinator, {
      municipality: municipality.id,
      advisors: [advisor.id, candidate.id],
    })
    fixtures.touchMunicipality(municipality.id)
    expect(
      assigned.advisors?.map((entry) => (typeof entry === 'number' ? entry : entry.id)),
    ).toEqual([advisor.id, candidate.id])

    const advisorOnly = await assignMunicipalityAdvisorsRecord(payload, coordinator, {
      municipality: municipality.id,
      advisors: [advisor.id],
    })
    expect(
      advisorOnly.advisors?.map((entry) => (typeof entry === 'number' ? entry : entry.id)),
    ).toEqual([advisor.id])

    const scope = await getAccessibleMunicipalityIds(
      stub<PayloadRequest>({ payload, user: advisor, context: {} }),
      advisor,
    )
    expect(scope).toEqual([municipality.id])
  })

  it('lets staff set expectedVotes with role and municipality scope enforced', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const updated = await setMunicipalityExpectedVotesRecord(payload, coordinator, {
      municipality: administered.id,
      expectedVotes: { pessimistic: null, central: 2500, optimistic: null },
    })
    expect(updated.expectedVotes?.central).toBe(2500)
    fixtures.touchMunicipality(administered.id)

    const advisorUpdated = await setMunicipalityExpectedVotesRecord(payload, advisor, {
      municipality: administered.id,
      expectedVotes: { pessimistic: null, central: 3000, optimistic: null },
    })
    expect(advisorUpdated.expectedVotes?.central).toBe(3000)
    fixtures.touchMunicipality(administered.id)

    await expect(
      setMunicipalityExpectedVotesRecord(payload, advisor, {
        municipality: outside.id,
        expectedVotes: { pessimistic: null, central: 100, optimistic: null },
      }),
    ).rejects.toThrow()

    const cleared = await setMunicipalityExpectedVotesRecord(payload, coordinator, {
      municipality: administered.id,
      expectedVotes: { pessimistic: null, central: null, optimistic: null },
    })
    expect(cleared.expectedVotes?.central ?? null).toBeNull()
    fixtures.touchMunicipality(administered.id)
  })

  it('lets staff set and clear political trend status', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const updated = await setMunicipalityPoliticalTrendRecord(payload, coordinator, {
      municipality: municipality.id,
      status: 'favoravel',
      note: null,
    })
    expect(updated.politicalTrend?.status).toBe('favoravel')
    fixtures.touchMunicipality(municipality.id)

    const cleared = await setMunicipalityPoliticalTrendRecord(payload, coordinator, {
      municipality: municipality.id,
      status: null,
      note: null,
    })
    expect(cleared.politicalTrend?.status).toBeNull()
    fixtures.touchMunicipality(municipality.id)
  })
})
