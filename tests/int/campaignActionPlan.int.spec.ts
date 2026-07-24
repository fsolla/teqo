// @vitest-environment node

import {
  getPayload,
  type Payload,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createActionPlanRecord } from '@/app/(campaign)/campanha/actions/actionPlan'
import { actionPlanCreateSchema, actionPlanUpdateSchema } from '@/lib/schemas/actionPlan'
import config from '@/payload.config'
import {
  canCreateActionPlan,
  canReadActionPlan,
  canUpdateActionPlan,
  getAccessibleLeadershipIds,
} from '@/utilities/campaignAccess'
import { parseActionPlanCreateFormData } from '@/utilities/actionPlanFormData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

/** Create data with server-derived fields (e.g. `slug`) intentionally omitted. */
type ActionPlanCreateData = RequiredDataFromCollectionSlug<'actionPlan'>

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const validPlanInput = (municipalityId: number) => ({
  title: campaignFixtures().value('Caminhada Centro'),
  kind: 'caminhada' as const,
  status: 'planejado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  municipality: municipalityId,
  locality: 'Centro',
})

describe('action plan domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires startAt outside rascunho and allows drafts without it', () => {
    expect(
      actionPlanCreateSchema.safeParse({
        ...validPlanInput(1),
        status: 'rascunho',
        startAt: undefined,
      }).success,
    ).toBe(true)

    expect(
      actionPlanCreateSchema.safeParse({
        ...validPlanInput(1),
        status: 'planejado',
        startAt: undefined,
      }).success,
    ).toBe(false)

    expect(
      actionPlanUpdateSchema.safeParse({
        id: 1,
        status: 'confirmado',
        startAt: null,
      }).success,
    ).toBe(false)
  })

  it('requires a municipality on create', () => {
    const result = actionPlanCreateSchema.safeParse({
      title: campaignFixtures().value('Plano sem Praça'),
      kind: 'caminhada',
      status: 'rascunho',
    })
    expect(result.success).toBe(false)
  })

  it('keeps the recorded origin of a new action plan', () => {
    const parsed = actionPlanCreateSchema.parse({
      ...validPlanInput(1),
      origin: 'pedido_broker',
    })

    expect(parsed.origin).toBe('pedido_broker')
  })

  it('parses the origin selected in the action plan form', () => {
    const formData = new FormData()
    formData.set('title', 'Caminhada no centro')
    formData.set('kind', 'caminhada')
    formData.set('status', 'rascunho')
    formData.set('municipality', '1')
    formData.set('origin', 'obrigacao_politica')
    formData.set('tasksJson', '[]')

    expect(parseActionPlanCreateFormData(formData).origin).toBe('obrigacao_politica')
  })

  it('parses several demand drafts from the action plan form', () => {
    const formData = new FormData()
    formData.set('title', 'Caminhada no centro')
    formData.set('kind', 'caminhada')
    formData.set('status', 'rascunho')
    formData.set('municipality', '1')
    formData.set('tasksJson', '[]')
    formData.set(
      'demandsJson',
      JSON.stringify([
        { title: 'Panfletos', kind: 'material' },
        { title: 'Van', kind: 'transporte', description: 'Levar a equipe.' },
      ]),
    )

    expect(parseActionPlanCreateFormData(formData).demands).toEqual([
      { title: 'Panfletos', kind: 'material' },
      { title: 'Van', kind: 'transporte', description: 'Levar a equipe.' },
    ])
  })

  it('creates several demands with the action plan in one workflow', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const plan = await createActionPlanRecord(
      payload,
      coordinator,
      {
        ...validPlanInput(municipality.id),
        title: fixtures.value('Plano com demandas'),
        origin: 'dado',
      },
      [
        { title: fixtures.value('Panfletos'), kind: 'material' },
        {
          title: fixtures.value('Van para equipe'),
          kind: 'transporte',
          description: 'Transporte para o dia da atividade.',
        },
      ],
    )
    fixtures.own('actionPlan', plan.id)

    const demands = await payload.find({
      collection: 'campaignDemand',
      where: { actionPlan: { equals: plan.id } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    demands.docs.forEach((demand) => fixtures.own('campaignDemand', demand.id))

    expect(demands.docs).toHaveLength(2)
    expect(demands.docs.map((demand) => demand.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Panfletos'),
        expect.stringContaining('Van para equipe'),
      ]),
    )
    expect(
      demands.docs.every((demand) => {
        const demandMunicipality =
          typeof demand.municipality === 'number' ? demand.municipality : demand.municipality.id
        return demandMunicipality === municipality.id
      }),
    ).toBe(true)
  })

  it('rolls back the plan and every nested demand when one demand conflicts', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const duplicateTitle = fixtures.value('Demanda já existente')
    await fixtures.createCampaignDemand({
      title: duplicateTitle,
      municipality: municipality.id,
      createdBy: coordinator.id,
    })
    const planTitle = fixtures.value('Plano que deve reverter')

    await expect(
      createActionPlanRecord(
        payload,
        coordinator,
        {
          ...validPlanInput(municipality.id),
          title: planTitle,
        },
        [
          { title: fixtures.value('Primeira demanda temporária'), kind: 'material' },
          { title: duplicateTitle, kind: 'transporte' },
        ],
      ),
    ).rejects.toThrow()

    const [plans, nestedDemands] = await Promise.all([
      payload.find({
        collection: 'actionPlan',
        where: { title: { equals: planTitle } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'campaignDemand',
        where: { title: { contains: 'Primeira demanda temporária' } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
    ])
    expect(plans.docs).toHaveLength(0)
    expect(nestedDemands.docs).toHaveLength(0)
  })

  it('scopes create/read/update by campaign role', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const otherAdvisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const createAsCoordinator = await canCreateActionPlan({
      req: stub<PayloadRequest>({ user: coordinator, payload, context: {} }),
    })
    const createAsAdvisor = await canCreateActionPlan({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
    })
    const createAsLeader = await canCreateActionPlan({
      req: stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
    })
    expect(createAsCoordinator).toBe(true)
    expect(createAsAdvisor).toBe(true)
    expect(createAsLeader).toBe(false)

    const plan = await payload.create({
      collection: 'actionPlan',
      data: stub<ActionPlanCreateData>({
        ...validPlanInput(municipality.id),
        advisors: [advisor.id],
        leadership: leadership.id,
        responsible: contact.id,
        createdBy: coordinator.id,
      }),
      overrideAccess: true,
    })
    fixtures.own('actionPlan', plan.id)

    const coordinatorRead = await canReadActionPlan({
      req: stub<PayloadRequest>({ user: coordinator, payload, context: {} }),
    })
    expect(coordinatorRead).toBe(true)

    const advisorRead = await canReadActionPlan({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
    })
    expect(advisorRead).toEqual({
      or: [{ advisors: { contains: advisor.id } }, { municipality: { in: [municipality.id] } }],
    })

    const otherAdvisorRead = await canReadActionPlan({
      req: stub<PayloadRequest>({ user: otherAdvisor, payload, context: {} }),
    })
    expect(otherAdvisorRead).toEqual({
      or: [{ advisors: { contains: otherAdvisor.id } }, { municipality: { in: [] } }],
    })

    const leaderRead = await canReadActionPlan({
      req: stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
    })
    expect(leaderRead).toBe(false)

    const leadershipIds = await getAccessibleLeadershipIds(
      stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
      leaderAccount,
    )
    expect(leadershipIds).toEqual([])

    const advisorUpdate = await canUpdateActionPlan({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
    })
    expect(advisorUpdate).toEqual({
      or: [{ advisors: { contains: advisor.id } }, { municipality: { in: [municipality.id] } }],
    })

    const visibleToAdvisor = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: advisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(visibleToAdvisor.totalDocs).toBe(1)

    const hiddenFromOther = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: otherAdvisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(hiddenFromOther.totalDocs).toBe(0)

    await expect(
      payload.find({
        collection: 'actionPlan',
        where: { id: { equals: plan.id } },
        user: leaderAccount,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('auto-includes the creating advisor in advisors', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const plan = await payload.create({
      collection: 'actionPlan',
      data: stub<ActionPlanCreateData>({
        ...validPlanInput(municipality.id),
        title: fixtures.value('Plano do assessor'),
      }),
      user: advisor,
      overrideAccess: false,
    })
    fixtures.own('actionPlan', plan.id)

    const advisorIds = (plan.advisors ?? []).map((value) =>
      typeof value === 'number' ? value : value.id,
    )
    expect(advisorIds).toEqual([advisor.id])
    expect(typeof plan.createdBy === 'number' ? plan.createdBy : plan.createdBy?.id).toBe(
      advisor.id,
    )
  })

  it('enforces schedule validation in the collection hook', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await expect(
      payload.create({
        collection: 'actionPlan',
        data: stub<ActionPlanCreateData>({
          ...validPlanInput(municipality.id),
          title: fixtures.value('Plano sem data'),
          startAt: null,
          createdBy: coordinator.id,
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('Informe a data e horário de início ao planejar ou confirmar o plano.')

    const start = new Date(Date.now() + 86_400_000)
    await expect(
      payload.create({
        collection: 'actionPlan',
        data: stub<ActionPlanCreateData>({
          ...validPlanInput(municipality.id),
          title: fixtures.value('Plano com término invertido'),
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() - 3_600_000).toISOString(),
          createdBy: coordinator.id,
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('O horário de término deve ser posterior ao de início.')
  })

  it('denies leaders from updating action plans', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const plan = await payload.create({
      collection: 'actionPlan',
      data: stub<ActionPlanCreateData>({
        ...validPlanInput(municipality.id),
        title: fixtures.value('Plano Tarefas'),
        advisors: [advisor.id],
        leadership: leadership.id,
        tasks: [{ title: 'Levar faixas', done: false }],
      }),
      overrideAccess: true,
    })
    fixtures.own('actionPlan', plan.id)

    await expect(
      payload.update({
        collection: 'actionPlan',
        id: plan.id,
        data: {
          tasks: [{ title: 'Levar faixas', done: true }],
        },
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
