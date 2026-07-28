// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { setMunicipalityEngagementLevelRecord } from '@/app/(campaign)/campanha/actions/municipality'
import { ENGAGEMENT_LEVEL_PATTERN_ID, EngagementLevelBlockedError } from '@/lib/engagementLevel'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const findDecisions = (municipalityID: number) =>
  payload.find({
    collection: 'allocationDecision',
    where: { municipality: { equals: municipalityID } },
    sort: 'createdAt',
    depth: 0,
    pagination: false,
  })

describe('municipality engagement level (E14)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('records the level and its movement decision in one transaction', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    const updated = await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n3',
      note: 'Prefeitura aliada e duas lideranças novas.',
      reversalSignals: 'Rompimento do prefeito ou pledges abaixo de 40% da meta.',
    })
    fixtures.touchMunicipality(municipality.id)

    expect(updated.engagementLevel).toBe('n3')
    expect(updated.levelNote).toBe('Prefeitura aliada e duas lideranças novas.')
    expect(updated.levelChangedAt).toBeTruthy()

    const decisions = await findDecisions(municipality.id)
    expect(decisions.docs).toHaveLength(1)
    const decision = decisions.docs[0]!
    fixtures.own('allocationDecision', decision.id)

    expect(decision.patternId).toBe(ENGAGEMENT_LEVEL_PATTERN_ID)
    expect(decision.outcome).toBe('movimento')
    expect(decision.rationale).toBe('Prefeitura aliada e duas lideranças novas.')
    expect(decision.decidedBy).toBe(coordinator.id)
    expect(decision.snapshot).toMatchObject({
      from: null,
      to: 'n3',
      reversalSignals: 'Rompimento do prefeito ou pledges abaixo de 40% da meta.',
      violations: [],
      overridden: false,
    })
  })

  it('holds a movement that breaks the rules and writes nothing', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n1',
      note: 'Entrada no mapa como presença de mandato.',
      reversalSignals: 'Nenhuma agenda executada no trimestre.',
    })
    fixtures.touchMunicipality(municipality.id)

    // Two levels up, no triangulated shock, and the level was recorded seconds
    // ago — every rule at once.
    const blocked = await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n3',
      note: 'Achismo da semana.',
      reversalSignals: 'Nada.',
    }).catch((error: unknown) => error)

    expect(blocked).toBeInstanceOf(EngagementLevelBlockedError)
    expect((blocked as EngagementLevelBlockedError).violations.map((v) => v.id)).toContain(
      'salto-de-dois-niveis',
    )

    const unchanged = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(unchanged.engagementLevel).toBe('n1')

    const decisions = await findDecisions(municipality.id)
    expect(decisions.docs).toHaveLength(1)
    decisions.docs.forEach((decision) => fixtures.own('allocationDecision', decision.id))
  })

  it('lets the coordinator override knowingly and records what was overridden', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n1',
      note: 'Entrada no mapa.',
      reversalSignals: 'Agenda vazia por um trimestre.',
    })
    fixtures.touchMunicipality(municipality.id)

    const moved = await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n2',
      note: 'Adversário abriu comitê e o prefeito pediu presença.',
      reversalSignals: 'Comitê adversário fechar.',
      override: true,
    })
    expect(moved.engagementLevel).toBe('n2')

    const decisions = await findDecisions(municipality.id)
    decisions.docs.forEach((decision) => fixtures.own('allocationDecision', decision.id))
    expect(decisions.docs).toHaveLength(2)

    const latest = decisions.docs.at(-1)!
    expect(latest.snapshot).toMatchObject({
      from: 'n1',
      to: 'n2',
      overridden: true,
      // A promotion is not held by the protection window — that rule guards
      // against undoing a decision, not against deepening it.
      violations: ['dois-movimentos-no-mes'],
    })
  })

  it('accepts a two-level jump when a triangulated shock is declared', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { engagementLevel: 'n1' },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)
    // Push the clock out of both windows so the shock is the only thing at play.
    await payload.db.drizzle.execute(
      `UPDATE municipality SET level_changed_at = now() - interval '90 days' WHERE id = ${municipality.id}`,
    )

    const moved = await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n3',
      note: 'Três sinais independentes de invasão na mesma semana.',
      reversalSignals: 'Adversário recuar do território.',
      triangulatedShock: true,
    })
    expect(moved.engagementLevel).toBe('n3')

    const decisions = await findDecisions(municipality.id)
    decisions.docs.forEach((decision) => fixtures.own('allocationDecision', decision.id))
    expect(decisions.docs).toHaveLength(1)
    expect(decisions.docs[0]!.snapshot).toMatchObject({
      from: 'n1',
      to: 'n3',
      triangulatedShock: true,
      overridden: false,
    })
  })

  it('keeps the ladder with unrestricted staff — the advisor proposes, it does not move', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    await expect(
      setMunicipalityEngagementLevelRecord(payload, advisor, {
        municipality: municipality.id,
        level: 'n2',
        note: 'Quero subir o meu município.',
        reversalSignals: 'Nada.',
      }),
    ).rejects.toThrow('coordenação geral ou o candidato')

    const decisions = await findDecisions(municipality.id)
    expect(decisions.docs).toHaveLength(0)
  })

  it('hides the level from the leader and shows it to the advisor read-only', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n4',
      note: 'Prioridade máxima do ciclo.',
      reversalSignals: 'Queda de captura por dois meses.',
    })
    fixtures.touchMunicipality(municipality.id)
    const decisions = await findDecisions(municipality.id)
    decisions.docs.forEach((decision) => fixtures.own('allocationDecision', decision.id))

    const advisorRead = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    expect(advisorRead.engagementLevel).toBe('n4')

    // The advisor may edit the município, but not this field: Payload drops a
    // field the actor cannot write instead of failing the whole update, so the
    // proof is that the level did not move.
    const advisorAttempt = await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { engagementLevel: 'n0', levelNote: 'Assessor tentou mexer.' },
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    expect(advisorAttempt.engagementLevel).toBe('n4')
    expect(advisorAttempt.levelNote).toBe('Prioridade máxima do ciclo.')

    // The leader cannot read the município at all (lockdown), which is what
    // keeps the ladder off their surface.
    await expect(
      payload.findByID({
        collection: 'municipality',
        id: municipality.id,
        depth: 0,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
