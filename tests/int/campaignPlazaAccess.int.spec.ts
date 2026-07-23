// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  assignPlazaAdvisorsRecord,
  setPlazaExpectedVotesRecord,
  setPlazaPoliticalTrendRecord,
  updatePlazaStrategyRecord,
} from '@/app/(campaign)/campanha/actions/plaza'
import { plazaCatalog } from '@/lib/plazaCatalog'
import config from '@/payload.config'
import { getAccessiblePlazaIds } from '@/utilities/campaignAccess'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('plaza catalog seed and per-role access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('has all 436 predefined plazas seeded by the migration', async () => {
    const total = await payload.count({ collection: 'plaza', where: {} })
    expect(total.totalDocs).toBe(plazaCatalog.length)
    expect(total.totalDocs).toBe(436)

    const salvadorZones = await payload.count({
      collection: 'plaza',
      where: { and: [{ city: { equals: 'Salvador' } }, { kind: { equals: 'zona' } }] },
    })
    expect(salvadorZones.totalDocs).toBe(19)
  })

  it('gives the coordinator unrestricted plaza reads', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const result = await payload.count({
      collection: 'plaza',
      where: {},
      user: coordinator,
      overrideAccess: false,
    })
    expect(result.totalDocs).toBe(436)
  })

  it('scopes an advisor to the plazas they administer — including the map scope helper', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(administered.id, [advisor.id])

    const visible = await payload.find({
      collection: 'plaza',
      where: {},
      depth: 0,
      pagination: false,
      select: { name: true },
      user: advisor,
      overrideAccess: false,
    })
    expect(visible.docs.map((plaza) => plaza.id)).toEqual([administered.id])
  })

  it('scopes a leader to plazas linked through an engaged leadership', async () => {
    const fixtures = campaignFixtures()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const linked = await fixtures.getPlaza()
    const otherLinked = await fixtures.getPlaza()
    await fixtures.createLeadership({
      contact: contact.id,
      plazas: [linked.id, otherLinked.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    const visible = await payload.find({
      collection: 'plaza',
      where: {},
      depth: 0,
      pagination: false,
      select: { name: true },
      sort: 'id',
      user: account,
      overrideAccess: false,
    })
    expect(visible.docs.map((plaza) => plaza.id).sort((a, b) => a - b)).toEqual(
      [linked.id, otherLinked.id].sort((a, b) => a - b),
    )
  })

  it('revokes leader access when the leadership is no longer engaged', async () => {
    const fixtures = campaignFixtures()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const linked = await fixtures.getPlaza()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [linked.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    await payload.update({
      collection: 'leadership',
      id: leadership.id,
      data: { supportStatus: 'em_disputa' },
      depth: 0,
    })

    const visible = await payload.count({
      collection: 'plaza',
      where: {},
      user: account,
      overrideAccess: false,
    })
    expect(visible.totalDocs).toBe(0)
  })

  it('hides staff strategy fields from the leader even on linked plazas', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const plaza = await fixtures.getPlaza()
    await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: account.id,
      supportStatus: 'engajado',
    })

    await updatePlazaStrategyRecord(payload, coordinator, {
      plaza: plaza.id,
      priority: 'alta',
      voteGoals: { good: 5000, regular: 3000, minimum: 1000 },
      strengths: ['Base sindical forte'],
      dobradinhaNotes: 'Negociação com deputado estadual em curso.',
    })
    await setPlazaPoliticalTrendRecord(payload, coordinator, {
      plaza: plaza.id,
      status: 'desfavoravel',
      note: 'Prefeito rompeu com a chapa.',
    })
    await setPlazaExpectedVotesRecord(payload, coordinator, {
      plaza: plaza.id,
      expectedVotes: { pessimistic: null, central: 1200, optimistic: null },
    })
    fixtures.touchPlaza(plaza.id)

    const leaderRead = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
      user: account,
      overrideAccess: false,
    })
    const doc = leaderRead as unknown as Record<string, unknown>
    expect(doc.name).toBe(plaza.name)
    expect(doc.priority ?? null).toBeNull()
    expect(doc.voteGoals ?? null).toBeNull()
    expect(doc.expectedVotes ?? null).toBeNull()
    expect(doc.politicalTrend ?? null).toBeNull()
    // Read-denied arrays come back empty — the staff content must not leak.
    expect(doc.strengths ?? []).toEqual([])
    expect(doc.dobradinhaNotes ?? null).toBeNull()

    const staffRead = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
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

  it('lets an advisor edit strategy only on administered plazas', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getPlaza()
    const outside = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(administered.id, [advisor.id])

    const updated = await updatePlazaStrategyRecord(payload, advisor, {
      plaza: administered.id,
      voteGoals: { good: 800, regular: 500, minimum: 200 },
    })
    expect(updated.voteGoals?.regular).toBe(500)
    fixtures.touchPlaza(administered.id)

    await expect(
      updatePlazaStrategyRecord(payload, advisor, {
        plaza: outside.id,
        voteGoals: { good: 10, regular: null, minimum: null },
      }),
    ).rejects.toThrow()
  })

  it('restricts advisor assignment to the coordinator and validates roles', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const plaza = await fixtures.getPlaza()

    await expect(
      assignPlazaAdvisorsRecord(payload, advisor, { plaza: plaza.id, advisors: [advisor.id] }),
    ).rejects.toThrow('Coordenador Geral')

    await expect(
      assignPlazaAdvisorsRecord(payload, coordinator, {
        plaza: plaza.id,
        advisors: [leaderAccount.id],
      }),
    ).rejects.toThrow()

    const assigned = await assignPlazaAdvisorsRecord(payload, coordinator, {
      plaza: plaza.id,
      advisors: [advisor.id],
    })
    fixtures.touchPlaza(plaza.id)
    expect(
      assigned.advisors?.map((entry) => (typeof entry === 'number' ? entry : entry.id)),
    ).toEqual([advisor.id])

    const scope = await getAccessiblePlazaIds(
      { payload, user: advisor, context: {} } as never,
      advisor,
    )
    expect(scope).toEqual([plaza.id])
  })

  it('lets staff set expectedVotes with role and plaza scope enforced', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getPlaza()
    const outside = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(administered.id, [advisor.id])

    const updated = await setPlazaExpectedVotesRecord(payload, coordinator, {
      plaza: administered.id,
      expectedVotes: { pessimistic: null, central: 2500, optimistic: null },
    })
    expect(updated.expectedVotes?.central).toBe(2500)
    fixtures.touchPlaza(administered.id)

    const advisorUpdated = await setPlazaExpectedVotesRecord(payload, advisor, {
      plaza: administered.id,
      expectedVotes: { pessimistic: null, central: 3000, optimistic: null },
    })
    expect(advisorUpdated.expectedVotes?.central).toBe(3000)
    fixtures.touchPlaza(administered.id)

    await expect(
      setPlazaExpectedVotesRecord(payload, advisor, {
        plaza: outside.id,
        expectedVotes: { pessimistic: null, central: 100, optimistic: null },
      }),
    ).rejects.toThrow()

    const cleared = await setPlazaExpectedVotesRecord(payload, coordinator, {
      plaza: administered.id,
      expectedVotes: { pessimistic: null, central: null, optimistic: null },
    })
    expect(cleared.expectedVotes?.central ?? null).toBeNull()
    fixtures.touchPlaza(administered.id)
  })

  it('lets staff set and clear political trend status', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const plaza = await fixtures.getPlaza()

    const updated = await setPlazaPoliticalTrendRecord(payload, coordinator, {
      plaza: plaza.id,
      status: 'favoravel',
      note: null,
    })
    expect(updated.politicalTrend?.status).toBe('favoravel')
    fixtures.touchPlaza(plaza.id)

    const cleared = await setPlazaPoliticalTrendRecord(payload, coordinator, {
      plaza: plaza.id,
      status: null,
      note: null,
    })
    expect(cleared.politicalTrend?.status).toBeNull()
    fixtures.touchPlaza(plaza.id)
  })
})
