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

const validPlanInput = {
  get title() {
    return campaignFixtures().value('Caminhada Centro')
  },
  kind: 'caminhada' as const,
  status: 'planejado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  regions: ['Metropolitano de Salvador'],
  cities: ['Salvador'],
  locality: 'Centro',
}

describe('action plan domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires startAt outside rascunho and allows drafts without it', () => {
    expect(
      actionPlanCreateSchema.safeParse({
        ...validPlanInput,
        status: 'rascunho',
        startAt: undefined,
      }).success,
    ).toBe(true)

    expect(
      actionPlanCreateSchema.safeParse({
        ...validPlanInput,
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

  it('requires territory geography on create', () => {
    const result = actionPlanCreateSchema.safeParse({
      title: validPlanInput.title,
      kind: 'caminhada',
      status: 'rascunho',
    })
    expect(result.success).toBe(false)
  })

  it('scopes create/read/update by campaign role', async () => {
    const fixtures = campaignFixtures()
    const geral = await fixtures.createCampaignUser('geral')
    const coordinator = await fixtures.createCampaignUser('coordenador')
    const otherCoordinator = await fixtures.createCampaignUser('coordenador')
    const leadershipUser = await fixtures.createCampaignUser('lideranca')
    const contact = await fixtures.createContact()
    const nucleus = await fixtures.createNucleus({
      coordinators: [coordinator.id],
    })
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      nucleus: nucleus.id,
      user: leadershipUser.id,
      supportStatus: 'engajado',
    })

    const createAsGeral = await canCreateActionPlan({
      req: { user: geral, payload, context: {} } as never,
    })
    const createAsCoordinator = await canCreateActionPlan({
      req: { user: coordinator, payload, context: {} } as never,
    })
    const createAsLeadership = await canCreateActionPlan({
      req: { user: leadershipUser, payload, context: {} } as never,
    })
    expect(createAsGeral).toBe(true)
    expect(createAsCoordinator).toBe(true)
    expect(createAsLeadership).toBe(false)

    const plan = await payload.create({
      collection: 'actionPlan',
      data: {
        ...validPlanInput,
        coordinators: [coordinator.id],
        leadership: leadership.id,
        responsible: contact.id,
        createdBy: geral.id,
      } as never,
      overrideAccess: true,
    })
    fixtures.own('actionPlan', plan.id)

    const geralRead = await canReadActionPlan({
      req: { user: geral, payload, context: {} } as never,
    })
    expect(geralRead).toBe(true)

    const coordinatorRead = await canReadActionPlan({
      req: { user: coordinator, payload, context: {} } as never,
    })
    expect(coordinatorRead).toEqual({
      coordinators: { contains: coordinator.id },
    })

    const otherCoordinatorRead = await canReadActionPlan({
      req: { user: otherCoordinator, payload, context: {} } as never,
    })
    expect(otherCoordinatorRead).toEqual({
      coordinators: { contains: otherCoordinator.id },
    })

    const leadershipRead = await canReadActionPlan({
      req: { user: leadershipUser, payload, context: {} } as never,
    })
    expect(leadershipRead).toEqual({
      leadership: { in: [leadership.id] },
    })

    const leadershipIds = await getAccessibleLeadershipIds(
      { user: leadershipUser, payload, context: {} } as never,
      leadershipUser,
    )
    expect(leadershipIds).toEqual([leadership.id])

    const coordinatorUpdate = await canUpdateActionPlan({
      req: { user: coordinator, payload, context: {} } as never,
    })
    expect(coordinatorUpdate).toEqual({
      coordinators: { contains: coordinator.id },
    })

    const visibleToCoordinator = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: coordinator,
      overrideAccess: false,
      depth: 0,
    })
    expect(visibleToCoordinator.totalDocs).toBe(1)

    const hiddenFromOther = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: otherCoordinator,
      overrideAccess: false,
      depth: 0,
    })
    expect(hiddenFromOther.totalDocs).toBe(0)

    const visibleToLeadership = await payload.find({
      collection: 'actionPlan',
      where: { id: { equals: plan.id } },
      user: leadershipUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(visibleToLeadership.totalDocs).toBe(1)
  })

  it('lets leadership toggle task done but rejects title edits', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordenador')
    const leadershipUser = await fixtures.createCampaignUser('lideranca')
    const contact = await fixtures.createContact()
    const nucleus = await fixtures.createNucleus({
      coordinators: [coordinator.id],
    })
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      nucleus: nucleus.id,
      user: leadershipUser.id,
      supportStatus: 'engajado',
    })

    const plan = await payload.create({
      collection: 'actionPlan',
      data: {
        ...validPlanInput,
        title: fixtures.value('Plano Tarefas'),
        coordinators: [coordinator.id],
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
      user: leadershipUser,
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
        user: leadershipUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/só podem marcar tarefas|não pode ser alterado|Lideranças/i)
  })
})
