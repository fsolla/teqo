// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createCampaignDemandRecord,
  setCampaignDemandCostRecord,
  transitionCampaignDemandRecord,
  updateCampaignDemandDetailsRecord,
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

describe('campaign demand workflow', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createScenario = async () => {
    const fixtures = campaignFixtures()
    const plaza = await fixtures.getPlaza()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignPlazaAdvisors(plaza.id, [advisor.id])

    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    return { fixtures, plaza, coordinator, advisor, leaderAccount, leadership }
  }

  it('links a leader-created demand to their own leadership and opens it', async () => {
    const { fixtures, plaza, leaderAccount, leadership } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, leaderAccount, {
      title: fixtures.value('Som para caminhada'),
      kind: 'equipamento',
      description: 'Precisamos de carro de som para a caminhada de sábado.',
      plaza: plaza.id,
    })
    fixtures.own('campaignDemand', demand.id)

    expect(demand.status).toBe('aberta')
    expect(typeof demand.leadership === 'number' ? demand.leadership : demand.leadership?.id).toBe(
      leadership.id,
    )

    // History is staff-only — assert it via a privileged read.
    const raw = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.statusHistory).toHaveLength(1)
    expect(raw.statusHistory?.[0]?.status).toBe('aberta')
  })

  it('rejects a demand from a leader outside the plaza', async () => {
    const { fixtures, leaderAccount } = await createScenario()
    const otherPlaza = await fixtures.getPlaza()

    await expect(
      createCampaignDemandRecord(payload, leaderAccount, {
        title: fixtures.value('Fora do escopo'),
        kind: 'material',
        plaza: otherPlaza.id,
      }),
    ).rejects.toThrow()
  })

  it('runs the analyze → escalate → coordinator decision path with history', async () => {
    const { fixtures, plaza, coordinator, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, leaderAccount, {
      title: fixtures.value('Transporte'),
      kind: 'transporte',
      plaza: plaza.id,
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

    // Escalated decisions are coordinator-only.
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
    expect(approved.decidedBy).toBeTruthy()
    expect(approved.decidedAt).toBeTruthy()
    expect(approved.statusHistory?.map((entry) => entry.status)).toEqual([
      'aberta',
      'em_analise',
      'escalada',
      'aprovada',
    ])

    // Terminal state: no further transitions.
    await expect(
      transitionCampaignDemandRecord(payload, coordinator, {
        id: demand.id,
        status: 'em_analise',
        decisionNote: null,
      }),
    ).rejects.toThrow()
  })

  it('locks leader edits once the demand leaves "aberta"', async () => {
    const { fixtures, plaza, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, leaderAccount, {
      title: fixtures.value('Faixas'),
      kind: 'material',
      plaza: plaza.id,
    })
    fixtures.own('campaignDemand', demand.id)

    const edited = await updateCampaignDemandDetailsRecord(payload, leaderAccount, {
      id: demand.id,
      description: 'Atualizei os detalhes.',
    })
    expect(edited.description).toBe('Atualizei os detalhes.')

    await transitionCampaignDemandRecord(payload, advisor, {
      id: demand.id,
      status: 'em_analise',
      decisionNote: null,
    })

    await expect(
      updateCampaignDemandDetailsRecord(payload, leaderAccount, {
        id: demand.id,
        description: 'Tarde demais.',
      }),
    ).rejects.toThrow()
  })

  it('keeps cost staff-only: leaders never receive it', async () => {
    const { fixtures, plaza, advisor, leaderAccount } = await createScenario()

    const demand = await createCampaignDemandRecord(payload, leaderAccount, {
      title: fixtures.value('Aluguel de espaço'),
      kind: 'espaco',
      plaza: plaza.id,
    })
    fixtures.own('campaignDemand', demand.id)

    await setCampaignDemandCostRecord(payload, advisor, { id: demand.id, cost: 1500.5 })

    const leaderRead = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      user: leaderAccount,
      overrideAccess: false,
    })
    expect((leaderRead as unknown as Record<string, unknown>).cost ?? null).toBeNull()
    // Read-denied arrays serialize as empty — internal notes must not leak.
    expect((leaderRead as unknown as Record<string, unknown>).statusHistory ?? []).toEqual([])

    const staffRead = await payload.findByID({
      collection: 'campaignDemand',
      id: demand.id,
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    expect(staffRead.cost).toBe(1500.5)
  })

  it('scopes advisors to demands of administered plazas', async () => {
    const { fixtures, plaza, leaderAccount } = await createScenario()
    const outsideAdvisor = await fixtures.createCampaignUser('advisor')

    const demand = await createCampaignDemandRecord(payload, leaderAccount, {
      title: fixtures.value('Panfletos'),
      kind: 'material',
      plaza: plaza.id,
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
