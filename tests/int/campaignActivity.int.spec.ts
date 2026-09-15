// @vitest-environment node

import {
  getPayload,
  type Payload,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createActivityRecord,
  createTourDraftActivitiesRecord,
  loadActivityAgendaEventsRecord,
  loadActivityEditDraftRecord,
  rescheduleActivityRecord,
  updateActivityRecord,
} from '@/app/(campaign)/campanha/actions/activity'
import { allDayEndInstant, allDayStartInstant } from '@/lib/activityAllDay'
import { relationshipId } from '@/lib/relationship'
import {
  ACTIVITY_DEMANDS_MUNICIPALITY_MESSAGE,
  ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE,
  ACTIVITY_OUT_OF_SCOPE_MESSAGE,
  ACTIVITY_UNSCOPED_ADVISOR_MESSAGE,
  activityCreateSchema,
  activityUpdateSchema,
} from '@/lib/schemas/activity'
import config from '@/payload.config'
import { parseActivityCreateFormData, parseTourDraftFormData } from '@/utilities/activityFormData'
import {
  canCreateActivity,
  canReadActivity,
  canUpdateActivity,
  getAccessibleLeadershipIds,
} from '@/utilities/campaignAccess'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

/** Create data with server-derived fields (e.g. `slug`) intentionally omitted. */
type ActivityCreateData = RequiredDataFromCollectionSlug<'activity'>

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const validActivityInput = (municipalityId: number) => ({
  title: campaignFixtures().value('Caminhada Centro'),
  tags: ['Caminhada'],
  status: 'confirmado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  municipality: municipalityId,
  locality: 'Centro',
})

const createActivityInAdvisorScope = async (title: string, deputyPresent: boolean) => {
  const fixtures = campaignFixtures()
  const advisor = await fixtures.createCampaignUser('advisor')
  const municipality = await fixtures.getMunicipality()
  await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
  const activity = await payload.create({
    collection: 'activity',
    data: stub<ActivityCreateData>({
      ...validActivityInput(municipality.id),
      title: fixtures.value(title),
      deputyPresent,
    }),
    overrideAccess: true,
  })
  fixtures.own('activity', activity.id)
  return { activity, advisor }
}

describe('activity domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires startAt on create and update', () => {
    // Create schema only accepts 'confirmado' and always requires startAt.
    expect(
      activityCreateSchema.safeParse({
        ...validActivityInput(1),
        startAt: undefined,
      }).success,
    ).toBe(false)

    // Update schema also requires startAt.
    expect(
      activityUpdateSchema.safeParse({
        id: 1,
        status: 'confirmado',
        startAt: null,
      }).success,
    ).toBe(false)
  })

  it('allows an activity without a municipality for coordination and blocks advisors', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    // C165 — imported Google events are born without a município: the schema
    // accepts it and the create access enforces the role split.
    expect(
      activityCreateSchema.safeParse({
        title: fixtures.value('Atividade sem município'),
        tags: ['Caminhada'],
        status: 'confirmado',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        municipality: null,
      }).success,
    ).toBe(true)

    const coordinatorCreate = await canCreateActivity({
      req: stub<PayloadRequest>({ user: coordinator, payload, context: {} }),
      data: { title: 'Sem município' },
    })
    expect(coordinatorCreate).toBe(true)

    const advisorCreateWithoutMunicipality = await canCreateActivity({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
      data: { title: 'Sem município' },
    })
    expect(advisorCreateWithoutMunicipality).toBe(false)

    const advisorCreateWithMunicipality = await canCreateActivity({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
      data: { title: 'Com município', municipality: municipality.id },
    })
    expect(advisorCreateWithMunicipality).toBe(true)
  })

  it('creates and clears a municipality-less activity for coordination only (C165)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const activity = await createActivityRecord(payload, coordinator, {
      title: fixtures.value('Atividade sem município'),
      tags: [],
      status: 'confirmado',
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      municipality: null,
    })
    fixtures.own('activity', activity.id)
    expect(relationshipId(activity.municipality)).toBeNull()

    // Demandas continuam exigindo município (a demanda é entidade municipal).
    await expect(
      createActivityRecord(
        payload,
        coordinator,
        {
          ...validActivityInput(municipality.id),
          title: fixtures.value('Atividade sem município com demanda'),
          municipality: null,
        },
        [{ title: 'Panfletos', kind: 'material' }],
      ),
    ).rejects.toThrow(ACTIVITY_DEMANDS_MUNICIPALITY_MESSAGE)

    // O advisor não cria sem município (access + guarda da action)…
    await expect(
      createActivityRecord(payload, advisor, {
        title: fixtures.value('Sem município do assessor'),
        tags: [],
        status: 'confirmado',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        municipality: null,
      }),
    ).rejects.toThrow(ACTIVITY_UNSCOPED_ADVISOR_MESSAGE)

    // …nem aponta para um município fora da carteira.
    await expect(
      createActivityRecord(payload, advisor, {
        ...validActivityInput(outside.id),
        title: fixtures.value('Fora da carteira'),
      }),
    ).rejects.toThrow(ACTIVITY_OUT_OF_SCOPE_MESSAGE)

    // Updates: o coordenador limpa o município; o advisor não pode.
    const cleared = await updateActivityRecord(payload, coordinator, {
      id: activity.id,
      startAt: activity.startAt,
      municipality: null,
    })
    expect(relationshipId(cleared.municipality)).toBeNull()

    const advisorActivity = await createActivityRecord(payload, advisor, {
      ...validActivityInput(municipality.id),
      title: fixtures.value('Com município do assessor'),
    })
    fixtures.own('activity', advisorActivity.id)

    await expect(
      updateActivityRecord(payload, advisor, {
        id: advisorActivity.id,
        startAt: advisorActivity.startAt,
        municipality: null,
      }),
    ).rejects.toThrow(ACTIVITY_UNSCOPED_ADVISOR_MESSAGE)

    await expect(
      updateActivityRecord(payload, advisor, {
        id: advisorActivity.id,
        startAt: advisorActivity.startAt,
        municipality: outside.id,
      }),
    ).rejects.toThrow(ACTIVITY_OUT_OF_SCOPE_MESSAGE)
  })

  it('hides municipality-less activities from advisors even with Visão "Tudo" (C165)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const wideAdvisor = await fixtures.createCampaignUser('advisor', { visibility: 'tudo' })
    const responsibleAdvisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [responsibleAdvisor])

    const orphan = await createActivityRecord(payload, coordinator, {
      title: fixtures.value('Importada sem município'),
      tags: [],
      status: 'confirmado',
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      municipality: null,
    })
    fixtures.own('activity', orphan.id)

    // A coordenação lê; o advisor "tudo" e o advisor listado como responsável
    // não — a atividade sem município é coordenação/candidato-only.
    const coordinatorRead = await payload.find({
      collection: 'activity',
      where: { id: { equals: orphan.id } },
      user: coordinator,
      overrideAccess: false,
      depth: 0,
    })
    expect(coordinatorRead.totalDocs).toBe(1)

    const wideRead = await payload.find({
      collection: 'activity',
      where: { id: { equals: orphan.id } },
      user: wideAdvisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(wideRead.totalDocs).toBe(0)

    await payload.update({
      collection: 'activity',
      id: orphan.id,
      data: {
        responsible: [{ relationTo: 'campaignUser', value: responsibleAdvisor.id }],
      },
      overrideAccess: true,
    })
    const responsibleRead = await payload.find({
      collection: 'activity',
      where: { id: { equals: orphan.id } },
      user: responsibleAdvisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(responsibleRead.totalDocs).toBe(0)

    expect(
      await canReadActivity({
        req: stub<PayloadRequest>({ user: wideAdvisor, payload, context: {} }),
      }),
    ).toEqual({ municipality: { exists: true } })
  })

  it('parses several demand drafts from the activity form', () => {
    const formData = new FormData()
    formData.set('title', 'Caminhada no centro')
    formData.set('status', 'cancelado')
    formData.set('municipality', '1')
    formData.set('tasksJson', '[]')
    formData.set(
      'demandsJson',
      JSON.stringify([
        { title: 'Panfletos', kind: 'material' },
        { title: 'Van', kind: 'transporte', description: 'Levar a equipe.' },
      ]),
    )

    expect(parseActivityCreateFormData(formData).demands).toEqual([
      { title: 'Panfletos', kind: 'material' },
      { title: 'Van', kind: 'transporte', description: 'Levar a equipe.' },
    ])
  })

  it('creates several demands with the activity in one workflow', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const activity = await createActivityRecord(
      payload,
      coordinator,
      {
        ...validActivityInput(municipality.id),
        title: fixtures.value('Atividade com demandas'),
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
    fixtures.own('activity', activity.id)

    const demands = await payload.find({
      collection: 'campaignDemand',
      where: { activity: { equals: activity.id } },
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
      demands.docs.every((demand) => relationId(demand.municipality) === municipality.id),
    ).toBe(true)
  })

  it('rolls back the activity and every nested demand when one demand conflicts', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const duplicateTitle = fixtures.value('Demanda já existente')
    await fixtures.createCampaignDemand({
      title: duplicateTitle,
      municipality: municipality.id,
      createdBy: coordinator.id,
    })
    const activityTitle = fixtures.value('Atividade que deve reverter')

    await expect(
      createActivityRecord(
        payload,
        coordinator,
        {
          ...validActivityInput(municipality.id),
          title: activityTitle,
        },
        [
          { title: fixtures.value('Primeira demanda temporária'), kind: 'material' },
          { title: duplicateTitle, kind: 'transporte' },
        ],
      ),
    ).rejects.toThrow()

    const [activities, nestedDemands] = await Promise.all([
      payload.find({
        collection: 'activity',
        where: { title: { equals: activityTitle } },
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
    expect(activities.docs).toHaveLength(0)
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

    const createAsCoordinator = await canCreateActivity({
      req: stub<PayloadRequest>({ user: coordinator, payload, context: {} }),
    })
    const createAsAdvisor = await canCreateActivity({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
      data: { municipality: municipality.id },
    })
    const createAsLeader = await canCreateActivity({
      req: stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
    })
    expect(createAsCoordinator).toBe(true)
    expect(createAsAdvisor).toBe(true)
    expect(createAsLeader).toBe(false)

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        responsible: [
          { relationTo: 'campaignUser', value: advisor.id },
          { relationTo: 'leadership', value: leadership.id },
        ],
        createdBy: coordinator.id,
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', activity.id)

    const coordinatorRead = await canReadActivity({
      req: stub<PayloadRequest>({ user: coordinator, payload, context: {} }),
    })
    expect(coordinatorRead).toBe(true)

    const advisorRead = await canReadActivity({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
    })
    expect(advisorRead).toEqual({
      and: [
        { municipality: { exists: true } },
        {
          or: [
            { responsible: { equals: { relationTo: 'campaignUser', value: advisor.id } } },
            { municipality: { in: [municipality.id] } },
          ],
        },
      ],
    })

    const otherAdvisorRead = await canReadActivity({
      req: stub<PayloadRequest>({ user: otherAdvisor, payload, context: {} }),
    })
    expect(otherAdvisorRead).toEqual({
      and: [
        { municipality: { exists: true } },
        {
          or: [
            { responsible: { equals: { relationTo: 'campaignUser', value: otherAdvisor.id } } },
            { municipality: { in: [] } },
          ],
        },
      ],
    })

    const leaderRead = await canReadActivity({
      req: stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
    })
    expect(leaderRead).toBe(false)

    const leadershipIds = await getAccessibleLeadershipIds(
      stub<PayloadRequest>({ user: leaderAccount, payload, context: {} }),
      leaderAccount,
    )
    expect(leadershipIds).toEqual([])

    const advisorUpdate = await canUpdateActivity({
      req: stub<PayloadRequest>({ user: advisor, payload, context: {} }),
    })
    expect(advisorUpdate).toEqual({
      and: [
        { municipality: { exists: true } },
        {
          or: [
            { responsible: { equals: { relationTo: 'campaignUser', value: advisor.id } } },
            { municipality: { in: [municipality.id] } },
          ],
        },
      ],
    })

    const visibleToAdvisor = await payload.find({
      collection: 'activity',
      where: { id: { equals: activity.id } },
      user: advisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(visibleToAdvisor.totalDocs).toBe(1)

    const hiddenFromOther = await payload.find({
      collection: 'activity',
      where: { id: { equals: activity.id } },
      user: otherAdvisor,
      overrideAccess: false,
      depth: 0,
    })
    expect(hiddenFromOther.totalDocs).toBe(0)

    await expect(
      payload.find({
        collection: 'activity',
        where: { id: { equals: activity.id } },
        user: leaderAccount,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('grants an advisor access to an activity they are responsible for outside their portfolio (C90 polymorphic leg)', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const [ownMunicipality, otherMunicipality] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    await fixtures.assignMunicipalityAdvisors(ownMunicipality, [advisor])

    const visibleByResponsibility = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(otherMunicipality.id),
        title: fixtures.value('Fora do portfólio, mas responsável'),
        responsible: [{ relationTo: 'campaignUser', value: advisor.id }],
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', visibleByResponsibility.id)

    const invisible = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(otherMunicipality.id),
        title: fixtures.value('Fora do portfólio e sem o assessor'),
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', invisible.id)

    const result = await payload.find({
      collection: 'activity',
      where: { id: { in: [visibleByResponsibility.id, invisible.id] } },
      user: advisor,
      overrideAccess: false,
      depth: 0,
    })

    // The polymorphic `responsible` object-notation equals is the exact leg
    // that keeps the advisor's right when the municipality scope does not.
    expect(result.docs.map((doc) => doc.id)).toEqual([visibleByResponsibility.id])
  })

  it('loads the edit draft only inside the actor scope (C123 overlay)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const otherAdvisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    // Far-future startAt: this spec is about read scoping, not the agenda
    // window — and keeping the rows OUTSIDE the Google sync engine's
    // 90/365-day scan window avoids feeding the C126 parallel-flake class.
    const farFuture = new Date(Date.now() + 400 * 86_400_000).toISOString()

    const inScope = await createActivityRecord(payload, coordinator, {
      ...validActivityInput(municipality.id),
      title: fixtures.value('No portfólio do assessor'),
      startAt: farFuture,
    })
    fixtures.own('activity', inScope.id)
    const outOfScope = await createActivityRecord(payload, coordinator, {
      ...validActivityInput((await fixtures.getMunicipality()).id),
      title: fixtures.value('Fora do portfólio do assessor'),
      startAt: farFuture,
    })
    fixtures.own('activity', outOfScope.id)

    const advisorDraft = await loadActivityEditDraftRecord(payload, advisor, inScope.id)
    expect(advisorDraft.id).toBe(inScope.id)
    expect(advisorDraft.title).toBe(inScope.title)
    expect(advisorDraft.municipalityId).toBe(municipality.id)

    await expect(loadActivityEditDraftRecord(payload, otherAdvisor, inScope.id)).rejects.toThrow()
    await expect(loadActivityEditDraftRecord(payload, advisor, outOfScope.id)).rejects.toThrow()
  })

  it('lets a responsible advisor re-save an activity whose leadership they cannot read (C90 existence validation)', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const foreignMunicipality = await fixtures.getMunicipality()
    const foreignLeadership = await fixtures.createLeadership({
      contact: (await fixtures.createContact()).id,
      municipalities: [foreignMunicipality.id],
      supportStatus: 'engajado',
    })

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(foreignMunicipality.id),
        title: fixtures.value('Atividade que o assessor precisa editar'),
        responsible: [
          { relationTo: 'campaignUser', value: advisor.id },
          { relationTo: 'leadership', value: foreignLeadership.id },
        ],
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', activity.id)

    // The advisor has no portfolio in the foreign municipality, so the
    // leadership is outside their read scope — but they are responsible and
    // re-submitting the intact list must not dead-end the save.
    const updated = await payload.update({
      collection: 'activity',
      id: activity.id,
      data: {
        description: 'Ajuste do assessor responsável.',
        responsible: [
          { relationTo: 'campaignUser', value: advisor.id },
          { relationTo: 'leadership', value: foreignLeadership.id },
        ],
      },
      user: advisor,
      overrideAccess: false,
    })

    expect(updated.description).toBe('Ajuste do assessor responsável.')
    const persisted = await payload.findByID({
      collection: 'activity',
      id: activity.id,
      depth: 0,
      overrideAccess: true,
    })
    const responsibleIDs = (persisted.responsible ?? []).map((entry) => relationshipId(entry.value))
    expect(responsibleIDs).toEqual(expect.arrayContaining([advisor.id, foreignLeadership.id]))
  })

  it('auto-includes the creating advisor as responsible', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        title: fixtures.value('Atividade do assessor'),
      }),
      user: advisor,
      overrideAccess: false,
    })
    fixtures.own('activity', activity.id)

    const responsibleIDs = (activity.responsible ?? []).map((entry) => relationId(entry.value))
    expect(responsibleIDs).toEqual([advisor.id])
    expect(relationId(activity.createdBy)).toBe(advisor.id)
  })

  it('enforces schedule validation in the collection hook', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await expect(
      payload.create({
        collection: 'activity',
        data: stub<ActivityCreateData>({
          ...validActivityInput(municipality.id),
          title: fixtures.value('Atividade sem data'),
          startAt: undefined,
          createdBy: coordinator.id,
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('Informe a data e horário de início do compromisso.')

    const start = new Date(Date.now() + 86_400_000)
    await expect(
      payload.create({
        collection: 'activity',
        data: stub<ActivityCreateData>({
          ...validActivityInput(municipality.id),
          title: fixtures.value('Atividade com término invertido'),
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() - 3_600_000).toISOString(),
          createdBy: coordinator.id,
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('O horário de término deve ser posterior ao de início.')
  })

  it('creates a multi-day all-day commitment with day-boundary instants (C104)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const startAt = allDayStartInstant('2026-08-10')
    const endAt = allDayEndInstant('2026-08-12')

    const activity = await createActivityRecord(payload, coordinator, {
      title: fixtures.value('Giro de três dias'),
      tags: ['Giro'],
      status: 'confirmado',
      allDay: true,
      startAt,
      endAt,
      municipality: municipality.id,
    })

    expect(activity.allDay).toBe(true)
    expect(activity.startAt).toBe(startAt)
    expect(activity.endAt).toBe(endAt)

    const events = await loadActivityAgendaEventsRecord(payload, coordinator, {
      rangeStart: '2026-08-09T03:00:00.000Z',
      rangeEnd: '2026-08-14T03:00:00.000Z',
    })
    const event = events.find((candidate) => candidate.id === activity.id)
    expect(event?.allDay).toBe(true)
    expect(event?.startAt).toBe(startAt)
    expect(event?.endAt).toBe(endAt)
  })

  it('accepts a single-day all-day range with equal instants (C104)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const startAt = allDayStartInstant('2026-08-10')

    const activity = await createActivityRecord(payload, coordinator, {
      title: fixtures.value('Dia inteiro único'),
      status: 'confirmado',
      allDay: true,
      startAt,
      endAt: startAt,
      municipality: municipality.id,
    })

    expect(activity.allDay).toBe(true)
    expect(activity.endAt).toBe(startAt)
  })

  it('rejects an all-day range whose end precedes the start in the collection hook (C104)', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()

    await expect(
      payload.create({
        collection: 'activity',
        data: stub<ActivityCreateData>({
          ...validActivityInput(municipality.id),
          title: fixtures.value('Todo o dia invertido'),
          allDay: true,
          startAt: allDayStartInstant('2026-08-12'),
          endAt: allDayStartInstant('2026-08-10'),
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('A data de término deve ser igual ou posterior à de início.')
  })

  it('reschedules an all-day commitment keeping the day granularity (C104)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        title: fixtures.value('Todo o dia remarcável'),
        allDay: true,
        startAt: allDayStartInstant('2026-08-10'),
        endAt: allDayEndInstant('2026-08-12'),
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', activity.id)

    const nextStart = allDayStartInstant('2026-08-20')
    const nextEnd = allDayEndInstant('2026-08-20')
    const updated = await rescheduleActivityRecord(payload, coordinator, {
      id: activity.id,
      allDay: true,
      startAt: nextStart,
      endAt: nextEnd,
    })

    expect(updated.allDay).toBe(true)
    expect(updated.startAt).toBe(nextStart)
    expect(updated.endAt).toBe(nextEnd)

    await expect(
      rescheduleActivityRecord(payload, coordinator, {
        id: activity.id,
        allDay: true,
        startAt: allDayStartInstant('2026-08-25'),
        endAt: allDayStartInstant('2026-08-24'),
      }),
    ).rejects.toThrow()
  })

  it('parses date-only form values into all-day instants (C104)', () => {
    const formData = new FormData()
    formData.set('title', 'Caminhada no centro')
    formData.set('status', 'confirmado')
    formData.set('allDay', 'on')
    formData.set('municipality', '1')
    formData.set('startAt', '2026-08-10')
    formData.set('endAt', '2026-08-12')
    formData.set('tagsJson', '[]')
    formData.set('demandsJson', '[]')

    const parsed = parseActivityCreateFormData(formData)
    expect(parsed.allDay).toBe(true)
    expect(parsed.startAt).toBe(allDayStartInstant('2026-08-10'))
    expect(parsed.endAt).toBe(allDayEndInstant('2026-08-12'))
  })

  it('parses the public event flag from the activity form (C151)', () => {
    const formData = new FormData()
    formData.set('title', 'Comício público')
    formData.set('status', 'confirmado')
    formData.set('municipality', '1')
    formData.set('tagsJson', '[]')
    formData.set('demandsJson', '[]')

    // Unchecked checkbox is absent from FormData — parses as false.
    expect(parseActivityCreateFormData(formData).publicEvent).toBe(false)

    formData.set('publicEvent', 'on')
    expect(parseActivityCreateFormData(formData).publicEvent).toBe(true)
  })

  it('persists the public event flag and returns it when reopening the overlay (C151)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const [markedMunicipality, ordinaryMunicipality] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    // Far-future startAt keeps these rows OUTSIDE the Google sync engine's
    // 90/365-day scan window, avoiding the C126 parallel-flake class.
    const farFuture = new Date(Date.now() + 400 * 86_400_000).toISOString()

    const marked = await createActivityRecord(payload, coordinator, {
      ...validActivityInput(markedMunicipality.id),
      title: fixtures.value('Evento público marcado'),
      startAt: farFuture,
      publicEvent: true,
    })
    fixtures.own('activity', marked.id)

    const ordinary = await createActivityRecord(payload, coordinator, {
      ...validActivityInput(ordinaryMunicipality.id),
      title: fixtures.value('Atividade interna'),
      startAt: farFuture,
    })
    fixtures.own('activity', ordinary.id)

    expect(marked.publicEvent).toBe(true)
    expect(ordinary.publicEvent).toBe(false)
    expect((await loadActivityEditDraftRecord(payload, coordinator, marked.id)).publicEvent).toBe(
      true,
    )
    expect((await loadActivityEditDraftRecord(payload, coordinator, ordinary.id)).publicEvent).toBe(
      false,
    )
  })

  it('loads only accessible events matching the agenda range and filters', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const [inScope, outOfScope] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    await fixtures.assignMunicipalityAdvisors(inScope, [advisor])
    const rangeStart = new Date('2026-08-03T03:00:00.000Z')
    const rangeEnd = new Date('2026-08-10T03:00:00.000Z')

    const matching = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(inScope.id),
        title: fixtures.value('Comício que atravessa a semana'),
        tags: ['Comício'],
        deputyPresent: true,
        startAt: new Date(rangeStart.getTime() - 3_600_000).toISOString(),
        endAt: new Date(rangeStart.getTime() + 3_600_000).toISOString(),
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', matching.id)

    for (const data of [
      {
        title: fixtures.value('Tag diferente'),
        municipality: inScope.id,
        tags: ['Reunião'],
      },
      {
        title: fixtures.value('Fora do escopo'),
        municipality: outOfScope.id,
        tags: ['Comício'],
      },
    ]) {
      const activity = await payload.create({
        collection: 'activity',
        data: stub<ActivityCreateData>({
          ...validActivityInput(data.municipality),
          ...data,
          deputyPresent: true,
          startAt: new Date(rangeStart.getTime() + 3_600_000).toISOString(),
        }),
        overrideAccess: true,
      })
      fixtures.own('activity', activity.id)
    }

    const events = await loadActivityAgendaEventsRecord(payload, advisor, {
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      municipality: inScope.id,
      deputyPresent: true,
      tag: 'Comício',
    })

    expect(events.map((event) => event.id)).toEqual([matching.id])
    expect(events[0]?.municipality?.id).toBe(inScope.id)
    expect(events[0]?.canReschedule).toBe(false)
  })

  it('allows an advisor to reschedule an ordinary activity in their scope', async () => {
    const { activity, advisor } = await createActivityInAdvisorScope(
      'Atividade comum para remarcar',
      false,
    )
    const nextStart = new Date(Date.now() + 172_800_000).toISOString()

    const updated = await rescheduleActivityRecord(payload, advisor, {
      allDay: false,
      id: activity.id,
      startAt: nextStart,
      endAt: null,
    })

    expect(updated.startAt).toBe(nextStart)
    expect(updated.endAt).toBeNull()
  })

  it('keeps a deputy commitment unchanged when an advisor tries to reschedule it', async () => {
    const { activity, advisor } = await createActivityInAdvisorScope(
      'Agenda do deputado protegida',
      true,
    )
    const originalStart = activity.startAt

    await expect(
      rescheduleActivityRecord(payload, advisor, {
        allDay: false,
        id: activity.id,
        startAt: new Date(Date.now() + 259_200_000).toISOString(),
        endAt: null,
      }),
    ).rejects.toThrow(ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE)

    const persisted = await payload.findByID({
      collection: 'activity',
      id: activity.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(persisted.startAt).toBe(originalStart)
  })

  it('allows coordinator and candidate to reschedule a deputy commitment', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const candidate = await fixtures.createCampaignUser('candidate')
    const municipality = await fixtures.getMunicipality()
    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        title: fixtures.value('Agenda do deputado liberada'),
        deputyPresent: true,
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', activity.id)

    for (const [actor, offset] of [
      [coordinator, 345_600_000],
      [candidate, 432_000_000],
    ] as const) {
      const nextStart = new Date(Date.now() + offset).toISOString()
      const updated = await rescheduleActivityRecord(payload, actor, {
        allDay: false,
        id: activity.id,
        startAt: nextStart,
        endAt: null,
      })
      expect(updated.startAt).toBe(nextStart)
    }
  })

  it('blocks changing the time while marking an activity as deputy-present', async () => {
    const { activity, advisor } = await createActivityInAdvisorScope(
      'Presença e horário no mesmo write',
      false,
    )

    await expect(
      payload.update({
        collection: 'activity',
        id: activity.id,
        data: {
          deputyPresent: true,
          startAt: new Date(Date.now() + 518_400_000).toISOString(),
        },
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE)
  })

  it('denies leaders from updating activities', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        title: fixtures.value('Atividade Tarefas'),
        responsible: [{ relationTo: 'campaignUser', value: advisor.id }],
        tasks: [{ title: 'Levar faixas', done: false }],
      }),
      overrideAccess: true,
    })
    fixtures.own('activity', activity.id)

    await expect(
      payload.update({
        collection: 'activity',
        id: activity.id,
        data: {
          tasks: [{ title: 'Levar faixas', done: true }],
        },
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})

const tourFormData = (
  stops: unknown,
  { tourName = 'Giro Sisal 27/07', note }: { tourName?: string; note?: string } = {},
): FormData => {
  const formData = new FormData()
  formData.set('tourName', tourName)
  if (note !== undefined) formData.set('note', note)
  formData.set('stopsJson', JSON.stringify(stops))
  return formData
}

describe('tour composer (E13)', () => {
  it('parses the giro name, the shared note and one stop per município', () => {
    expect(
      parseTourDraftFormData(
        tourFormData(
          [
            { municipality: 7, tags: ['Comício'] },
            { municipality: 9, tags: ['Reunião de Apoio'] },
          ],
          { note: 'Falar com o vereador antes.' },
        ),
      ),
    ).toEqual({
      tourName: 'Giro Sisal 27/07',
      note: 'Falar com o vereador antes.',
      stops: [
        { municipality: 7, tags: ['Comício'] },
        { municipality: 9, tags: ['Reunião de Apoio'] },
      ],
    })
  })

  it('refuses a composition it cannot trust', () => {
    expect(() => parseTourDraftFormData(tourFormData([]))).toThrow(/ao menos uma parada/i)
    expect(() =>
      parseTourDraftFormData(tourFormData([{ municipality: 0, tags: ['Comício'] }])),
    ).toThrow(/Paradas do giro inválidas/i)
    expect(() =>
      parseTourDraftFormData(
        tourFormData([{ municipality: 7, tags: ['Comício'] }], {
          tourName: 'G'.repeat(120),
        }),
      ),
    ).toThrow(/muito longo/i)
  })

  it('writes every stop of a giro as a draft in one transaction, titled after the município', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const [anchor, satellite] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    const tourName = fixtures.value('Giro do teste')

    const created = await createTourDraftActivitiesRecord(payload, coordinator, {
      tourName,
      note: 'Falar com o vereador antes.',
      stops: [
        { municipality: anchor.id, tags: ['Comício'] },
        { municipality: satellite.id, tags: ['Reunião de Apoio'] },
      ],
    })
    created.forEach((activity) => fixtures.own('activity', activity.id))

    expect(created).toHaveLength(2)
    // The title names the município as the DATABASE spells it — the client only
    // ever sent the id, which is also the only thing that granted the write.
    expect(created.map((activity) => activity.title)).toEqual([
      `${tourName} — ${anchor.name}`,
      `${tourName} — ${satellite.name}`,
    ])
    expect(
      created.every((activity) => activity.description === 'Falar com o vereador antes.'),
    ).toBe(true)
    // Drafts without a date, flagged as the candidate's own agenda: that flag is
    // what makes a giro derivable without a `tour` entity.
    expect(created.every((activity) => activity.status === 'confirmado')).toBe(true)
    expect(created.every((activity) => activity.deputyPresent === true)).toBe(true)
    expect(created.every((activity) => activity.startAt === null)).toBe(true)
  })

  it('rolls back the whole giro when one stop is outside the advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const [inPortfolio, outOfPortfolio] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    await fixtures.assignMunicipalityAdvisors(inPortfolio, [advisor])
    const tourName = fixtures.value('Giro fora de escopo')

    await expect(
      createTourDraftActivitiesRecord(payload, advisor, {
        tourName,
        note: undefined,
        stops: [
          { municipality: inPortfolio.id, tags: ['Comício'] },
          { municipality: outOfPortfolio.id, tags: ['Reunião de Apoio'] },
        ],
      }),
    ).rejects.toThrow(/fora do seu escopo|saiu do seu escopo/i)

    const leftovers = await payload.find({
      collection: 'activity',
      where: { title: { contains: tourName } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    leftovers.docs.forEach((activity) => fixtures.own('activity', activity.id))
    expect(leftovers.docs).toHaveLength(0)
  })

  it('caps a giro so one submit cannot write an unbounded batch', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await expect(
      createTourDraftActivitiesRecord(payload, coordinator, {
        tourName: fixtures.value('Giro grande demais'),
        note: undefined,
        stops: Array.from({ length: 9 }, () => ({
          municipality: municipality.id,
          tags: ['Reunião de Apoio'] as const,
        })),
      }),
    ).rejects.toThrow(/no máximo 8 paradas/i)
  })
})
