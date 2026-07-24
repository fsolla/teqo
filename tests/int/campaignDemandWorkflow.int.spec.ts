// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createCampaignDemandRecord,
  setCampaignDemandCostRecord,
  transitionCampaignDemandRecord,
} from '@/app/(campaign)/campanha/actions/demand'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign demand workflow (staff-only)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createScenario = async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const candidate = await fixtures.createCampaignUser('candidate')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    return { fixtures, municipality, coordinator, advisor, candidate, leaderAccount, leadership }
  }

  it('lets staff open a demand in an administered municipality', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Som para caminhada'),
      kind: 'equipamento',
      description: 'Precisamos de carro de som para a caminhada de sábado.',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    expect(demand.status).toBe('aberta')

    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.statusHistory).toHaveLength(1)
    expect(raw.statusHistory?.[0]?.status).toBe('aberta')
  })

  it('rejects demand creation from leaders', async () => {
    const { fixtures, municipality, leaderAccount } = await createScenario()

    await expect(
      createCampaignDemandRecord(payload, leaderAccount, {
        title: fixtures.value('Bloqueado'),
        kind: 'material',
        municipality: municipality.id,
      }),
    ).rejects.toThrow()
  })

  it('rejects a demand from an advisor outside the municipality', async () => {
    const { fixtures, leaderAccount: _leader, municipality: _municipality } = await createScenario()
    const outsideAdvisor = await fixtures.createCampaignUser('advisor')
    const otherMunicipality = await fixtures.getMunicipality()

    await expect(
      createCampaignDemandRecord(payload, outsideAdvisor, {
        title: fixtures.value('Fora do escopo'),
        kind: 'material',
        municipality: otherMunicipality.id,
      }),
    ).rejects.toThrow()
  })

  it('runs the analyze → escalate → coordinator/candidate decision path with history', async () => {
    const { fixtures, municipality, coordinator, advisor, candidate } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Transporte'),
      kind: 'transporte',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const analyzing = await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'em_analise',
      decisionNote: null,
    })
    expect(analyzing.status).toBe('em_analise')

    const escalated = await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'escalada',
      decisionNote: 'Custo acima da alçada.',
    })
    expect(escalated.status).toBe('escalada')

    await expect(
      transitionCampaignDemandRecord(payload, advisor, {
        id: demand.id,
        status: 'aprovada',
        decisionNote: null,
      }),
    ).rejects.toThrow('Coordenador Geral')

    const approved = await transitionCampaignDemandRecord(payload, coordinator, {
      id: demand.id,
      status: 'aprovada',
      decisionNote: 'Aprovado com ajuste de valor.',
    })
    expect(approved.status).toBe('aprovada')

    const demandForCandidate = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Candidato decide'),
      kind: 'transporte',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demandForCandidate.id)
    await transitionCampaignDemandRecord(payload, advisor, {
      id: demandForCandidate.id,
      status: 'em_analise',
      decisionNote: null,
    })
    await transitionCampaignDemandRecord(payload, advisor, {
      id: demandForCandidate.id,
      status: 'escalada',
      decisionNote: 'Escalada.',
    })
    const candidateApproved = await transitionCampaignDemandRecord(payload, candidate, {
      id: demandForCandidate.id,
      status: 'aprovada',
      decisionNote: 'OK pelo candidato.',
    })
    expect(candidateApproved.status).toBe('aprovada')
  })

  it('denies leaders read access to demands', async () => {
    const { fixtures, municipality, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Faixas'),
      kind: 'material',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await expect(
      payload.find({
        collection: 'campaignDemand',
        where: { id: { equals: demand.id } },
        depth: 0,
        pagination: false,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('keeps cost staff-only', async () => {
    const { fixtures, municipality, advisor } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Aluguel de espaço'),
      kind: 'espaco',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await setCampaignDemandCostRecord(payload, advisor, { id: demand.id, cost: 1500.5 })

    const staffRead = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    expect(staffRead.cost).toBe(1500.5)
  })

  it('scopes advisors to demands of administered municipalities', async () => {
    const { fixtures, municipality, advisor } = await createScenario()
    const outsideAdvisor = await fixtures.createCampaignUser('advisor')

    const demand = await createCampaignDemandRecord(payload, advisor, {
      title: fixtures.value('Panfletos'),
      kind: 'material',
      municipality: municipality.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const visible = await payload.find({
      collection: 'campaignDemand',
      where: { id: { equals: demand.id } },
      depth: 0,
      pagination: false,
      user: outsideAdvisor,
      overrideAccess: false,
    })
    expect(visible.docs).toHaveLength(0)
  })
})
