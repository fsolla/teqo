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
} from '@/app/(campaign)/campanha/actions/activity'
import { activityCreateSchema, activityUpdateSchema } from '@/lib/schemas/activity'
import config from '@/payload.config'
import { parseActivityCreateFormData, parseTourDraftFormData } from '@/utilities/activityFormData'
import {
  canCreateActivity,
  canReadActivity,
  canUpdateActivity,
  getAccessibleLeadershipIds,
} from '@/utilities/campaignAccess'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
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
  kind: 'caminhada' as const,
  status: 'planejado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  municipality: municipalityId,
  locality: 'Centro',
})

describe('activity domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires startAt outside rascunho and allows drafts without it', () => {
    expect(
      activityCreateSchema.safeParse({
        ...validActivityInput(1),
        status: 'rascunho',
        startAt: undefined,
      }).success,
    ).toBe(true)

    expect(
      activityCreateSchema.safeParse({
        ...validActivityInput(1),
        status: 'planejado',
        startAt: undefined,
      }).success,
    ).toBe(false)

    expect(
      activityUpdateSchema.safeParse({
        id: 1,
        status: 'confirmado',
        startAt: null,
      }).success,
    ).toBe(false)
  })

  it('requires a municipality on create', () => {
    const result = activityCreateSchema.safeParse({
      title: campaignFixtures().value('Atividade sem município'),
      kind: 'caminhada',
      status: 'rascunho',
    })
    expect(result.success).toBe(false)
  })

  it('keeps the recorded origin of a new activity', () => {
    const parsed = activityCreateSchema.parse({
      ...validActivityInput(1),
      origin: 'pedido_broker',
    })

    expect(parsed.origin).toBe('pedido_broker')
  })

  it('parses the origin selected in the activity form', () => {
    const formData = new FormData()
    formData.set('title', 'Caminhada no centro')
    formData.set('kind', 'caminhada')
    formData.set('status', 'rascunho')
    formData.set('municipality', '1')
    formData.set('origin', 'obrigacao_politica')
    formData.set('tasksJson', '[]')

    expect(parseActivityCreateFormData(formData).origin).toBe('obrigacao_politica')
  })

  it('parses several demand drafts from the activity form', () => {
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
      demands.docs.every((demand) => {
        const demandMunicipality =
          typeof demand.municipality === 'number' ? demand.municipality : demand.municipality.id
        return demandMunicipality === municipality.id
      }),
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
        advisors: [advisor.id],
        leadership: leadership.id,
        responsible: contact.id,
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
      or: [{ advisors: { contains: advisor.id } }, { municipality: { in: [municipality.id] } }],
    })

    const otherAdvisorRead = await canReadActivity({
      req: stub<PayloadRequest>({ user: otherAdvisor, payload, context: {} }),
    })
    expect(otherAdvisorRead).toEqual({
      or: [{ advisors: { contains: otherAdvisor.id } }, { municipality: { in: [] } }],
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
      or: [{ advisors: { contains: advisor.id } }, { municipality: { in: [municipality.id] } }],
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

  it('auto-includes the creating advisor in advisors', async () => {
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

    const advisorIds = (activity.advisors ?? []).map((value) =>
      typeof value === 'number' ? value : value.id,
    )
    expect(advisorIds).toEqual([advisor.id])
    expect(
      typeof activity.createdBy === 'number' ? activity.createdBy : activity.createdBy?.id,
    ).toBe(advisor.id)
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
          startAt: null,
          createdBy: coordinator.id,
        }),
        overrideAccess: true,
      }),
    ).rejects.toThrow('Informe a data e horário de início ao planejar ou confirmar a atividade.')

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

  it('denies leaders from updating activities', async () => {
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

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        ...validActivityInput(municipality.id),
        title: fixtures.value('Atividade Tarefas'),
        advisors: [advisor.id],
        leadership: leadership.id,
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
            { municipality: 7, kind: 'comicio', origin: 'dado' },
            { municipality: 9, kind: 'reuniao_apoio', origin: 'pedido_broker' },
          ],
          { note: 'Falar com o vereador antes.' },
        ),
      ),
    ).toEqual({
      tourName: 'Giro Sisal 27/07',
      note: 'Falar com o vereador antes.',
      stops: [
        { municipality: 7, kind: 'comicio', origin: 'dado' },
        { municipality: 9, kind: 'reuniao_apoio', origin: 'pedido_broker' },
      ],
    })
  })

  it('refuses a composition it cannot trust', () => {
    expect(() => parseTourDraftFormData(tourFormData([]))).toThrow(/ao menos uma parada/i)
    expect(() =>
      parseTourDraftFormData(tourFormData([{ municipality: 7, kind: 'visita', origin: 'dado' }])),
    ).toThrow(/Paradas do giro inválidas/i)
    expect(() =>
      parseTourDraftFormData(tourFormData([{ municipality: 0, kind: 'comicio', origin: 'dado' }])),
    ).toThrow(/Paradas do giro inválidas/i)
    expect(() =>
      parseTourDraftFormData(
        tourFormData([{ municipality: 7, kind: 'comicio', origin: 'inventada' }]),
      ),
    ).toThrow(/Paradas do giro inválidas/i)
    expect(() =>
      parseTourDraftFormData(
        tourFormData([{ municipality: 7, kind: 'comicio', origin: 'dado' }], {
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
        { municipality: anchor.id, kind: 'comicio', origin: 'dado' },
        { municipality: satellite.id, kind: 'reuniao_apoio', origin: 'dado' },
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
    expect(created.every((activity) => activity.status === 'rascunho')).toBe(true)
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
          { municipality: inPortfolio.id, kind: 'comicio', origin: 'dado' },
          { municipality: outOfPortfolio.id, kind: 'reuniao_apoio', origin: 'dado' },
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
          kind: 'reuniao_apoio' as const,
          origin: 'dado' as const,
        })),
      }),
    ).rejects.toThrow(/no máximo 8 paradas/i)
  })
})
