// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  actionPlanCreateSchema,
  actionPlanUpdateSchema,
} from '@/lib/schemas/actionPlan'
import config from '@/payload.config'
import {
  canCreateActionPlan,
  canReadActionPlan,
  canUpdateActionPlan,
  getAccessibleLeadershipIds,
} from '@/utilities/campaignAccess'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const validPlanInput = (plazaId: number) => ({
  title: campaignFixtures().value('Caminhada Centro'),
  kind: 'caminhada' as const,
  status: 'planejado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  plaza: plazaId,
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

  it('requires a plaza on create', () => {
    const result = actionPlanCreateSchema.safeParse({
      title: campaignFixtures().value('Plano sem Praça'),
      kind: 'caminhada',
      status: 'rascunho',
    })
    expect(result.success).toBe(false)
  })

  it('scopes create/read/update by campaign role', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const otherAdvisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const plaza = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(plaza, [advisor])
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const createAsCoordinator = await canCreateActionPlan({
      req: { user: coordinator, payload, context: {} } as never,
    })
    const createAsAdvisor = await canCreateActionPlan({
      req: { user: advisor, payload, context: {} } as never,
    })
    const createAsLeader = await canCreateActionPlan({
      req: { user: leaderAccount, payload, context: {} } as never,
    })
    expect(createAsCoordinator).toBe(true)
    expect(createAsAdvisor).toBe(true)
    expect(createAsLeader).toBe(false)

    const plan = await payload.create({
      collection: 'actionPlan',
      data: {
        ...validPlanInput(plaza.id),
        advisors: [advisor.id],
        leadership: leadership.id,
        responsible: contact.id,
        createdBy: coordinator.id,
      } as never,
      overrideAccess: true,
    })
    fixtures.own('actionPlan', plan.id)

    const coordinatorRead = await canReadActionPlan({
      req: { user: coordinator, payload, context: {} } as never,
    })
    expect(coordinatorRead).toBe(true)

    const advisorRead = await canReadActionPlan({
      req: { user: advisor, payload, context: {} } as never,
    })
    expect(advisorRead).toEqual({
      or: [
        { advisors: { contains: advisor.id } },
        { plaza: { in: [plaza.id] } },
      ],
    })

    const otherAdvisorRead = await canReadActionPlan({
      req: { user: otherAdvisor, payload, context: {} } as never,
    })
    expect(otherAdvisorRead).toEqual({
      or: [
        { advisors: { contains: otherAdvisor.id } },
        { plaza: { in: [] } },
      ],
    })

    const leaderRead = await canReadActionPlan({
      req: { user: leaderAccount, payload, context: {} } as never,
    })
    expect(leaderRead).toEqual({
      leadership: { in: [leadership.id] },
    })

    const leadershipIds = await getAccessibleLeadershipIds(
      { user: leaderAccount, payload, context: {} } as never,
      leaderAccount,
    )
    expect(leadershipIds).toEqual([leadership.id])

    const advisorUpdate = await canUpdateActionPlan({
      req: { user: advisor, payload, context: {} } as never,
    })
    expect(advisorUpdate).toEqual({
      or: [
        { advisors: { contains: advisor.id } },
        { plaza: { in: [plaza.id] } },
      ],
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

    const visibleToLeader = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: leaderAccount,
      overrideAccess: false,
      depth: 0,
    })
    expect(visibleToLeader.totalDocs).toBe(1)
  })

  it('auto-includes the creating advisor in advisors', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const plaza = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(plaza, [advisor])

    const plan = await payload.create({
      collection: 'actionPlan',
      data: {
        ...validPlanInput(plaza.id),
        title: fixtures.value('Plano do assessor'),
      } as never,
      user: advisor,
      overrideAccess: false,
    })
    fixtures.own('actionPlan', plan.id)

    const advisorIds = (plan.advisors ?? []).map((value) =>
      typeof value === 'number' ? value : value.id,
    )
    expect(advisorIds).toEqual([advisor.id])
    expect(
      typeof plan.createdBy === 'number' ? plan.createdBy : plan.createdBy?.id,
    ).toBe(advisor.id)
  })

  it('enforces schedule validation in the collection hook', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const plaza = await fixtures.getPlaza()

    await expect(
      payload.create({
        collection: 'actionPlan',
        data: {
          ...validPlanInput(plaza.id),
          title: fixtures.value('Plano sem data'),
          startAt: null,
          createdBy: coordinator.id,
        } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow('Informe a data e horário de início ao planejar ou confirmar o plano.')

    const start = new Date(Date.now() + 86_400_000)
    await expect(
      payload.create({
        collection: 'actionPlan',
        data: {
          ...validPlanInput(plaza.id),
          title: fixtures.value('Plano com término invertido'),
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() - 3_600_000).toISOString(),
          createdBy: coordinator.id,
        } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow('O horário de término deve ser posterior ao de início.')
  })

  it('lets a leader toggle task done but rejects title edits', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const plaza = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(plaza, [advisor])
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const plan = await payload.create({
      collection: 'actionPlan',
      data: {
        ...validPlanInput(plaza.id),
        title: fixtures.value('Plano Tarefas'),
        advisors: [advisor.id],
        leadership: leadership.id,
        tasks: [{ title: 'Levar faixas', done: false }],
      } as never,
      overrideAccess: true,
    })
    fixtures.own('actionPlan', plan.id)

    const toggled = await payload.update({
      collection: 'actionPlan',
      id: plan.id,
      data: {
        tasks: [{ title: 'Levar faixas', done: true }],
      } as never,
      user: leaderAccount,
      overrideAccess: false,
    })
    expect(toggled.tasks?.[0]?.done).toBe(true)
    expect(toggled.tasks?.[0]?.doneAt).toBeTruthy()

    await expect(
      payload.update({
        collection: 'actionPlan',
        id: plan.id,
        data: {
          title: 'Título alterado pela liderança',
        } as never,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/só podem marcar tarefas|não pode ser alterado|Lideranças/i)
  })
})
