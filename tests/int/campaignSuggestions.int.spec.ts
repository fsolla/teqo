// @vitest-environment node

import { getPayload, type Payload, type RequiredDataFromCollectionSlug } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { resolveSuggestionRecord } from '@/app/(campaign)/campanha/actions/suggestion'
import { SUGGESTION_STALE_MESSAGE } from '@/lib/schemas/suggestion'
import { DAY_MS } from '@/lib/text'
import type { CampaignUser, Municipality } from '@/payload-types'
import config from '@/payload.config'
import {
  computeAllMunicipalityPotentials,
  computeMunicipalityPotential,
} from '@/utilities/municipality/municipalityPotential'
import { loadMunicipalitySuggestions } from '@/utilities/municipality/municipalityTriggers'

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

/**
 * E11's loader meets real rows here: the access scope, the four auxiliary
 * queries (pledges, leadership counts, signals→agenda inputs, decisions) and
 * the suppression wiring. Trigger predicates themselves are pure and pinned in
 * `suggestionCatalog.unit.spec.ts` — this spec drives the ROW-controllable
 * patterns (P7, K-A, P6) because the artifact-anchored ones (P1/P2/P3/P5/K-B)
 * cannot be staged from the database: their conditions live in the committed
 * TSE artifact, and hand-picking catalog slugs would race the fixture
 * allocator (a wrapping sequence — an explicit slug is never exclusively
 * owned). Where a test needs an artifact property (P6's upper quartile, the
 * silence review's "nothing fires"), it claims municípios through the
 * allocator until one qualifies — measured hit rates: 109/435 top-quartile,
 * 205/435 quiet.
 */

/** Reset the row-controllable fields a previous test (or seed) may have set. */
const normalizeMunicipality = async (
  municipality: Municipality,
  data: Partial<Pick<Municipality, 'priority' | 'expectedVotes' | 'engagementLevel'>> = {},
) => {
  await payload.update({
    collection: 'municipality',
    id: municipality.id,
    data: {
      advisors: [],
      priority: 'normal',
      engagementLevel: null,
      expectedVotes: { pessimistic: null, central: null, optimistic: null },
      ...data,
    },
    depth: 0,
  })
}

const suggestionsFor = (user: CampaignUser, municipalityID?: number) =>
  loadMunicipalitySuggestions(payload, user, { municipalityID })

const backdatePledgeDeclaredAt = async (pledgeID: number, days: number) => {
  await payload.db.drizzle.execute(
    `UPDATE vote_pledge SET declared_at = now() - interval '${days} days' WHERE id = ${pledgeID}`,
  )
}

/** A prioritized município with one stale pledge and a real goal: P7's stage. */
const stageStalePledge = async (
  fixtures: ReturnType<typeof campaignFixtures>,
  municipality: Municipality,
) => {
  await normalizeMunicipality(municipality, {
    priority: 'alta',
    expectedVotes: { pessimistic: null, central: 5000, optimistic: null },
  })
  fixtures.touchMunicipality(municipality.id)
  const contact = await fixtures.createContact()
  const leadership = await fixtures.createLeadership({
    contact: contact.id,
    municipalities: [municipality.id],
  })
  const pledge = await fixtures.createVotePledge({
    leadership: leadership.id,
    municipality: municipality.id,
    declaredVotes: 100,
  })
  await backdatePledgeDeclaredAt(pledge.id, 30)
}

describe('loadMunicipalitySuggestions (E11)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('fires P7 on a prioritized stale-pledge município and lets decisions govern it', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    const findP7 = async () => {
      const bundle = await suggestionsFor(coordinator, municipality.id)
      return bundle.suggestions.find(
        (suggestion) =>
          suggestion.patternId === 'P7' && suggestion.municipalityID === municipality.id,
      )
    }

    const triggered = await findP7()
    expect(triggered).toBeDefined()
    expect(triggered?.triageLevel).toBe(5)
    expect(triggered?.metrics.pledgeCount).toBe(1)
    expect(triggered?.metrics.lastPledgeAgeDays).toBeGreaterThanOrEqual(29)
    expect(triggered?.factors.join(' ')).toContain('dias')

    // A dismissal recorded now keeps the pattern out of the queue…
    const dismissed = await payload.create({
      collection: 'allocationDecision',
      data: {
        municipality: municipality.id,
        patternId: 'P7',
        outcome: 'descarta',
        rationale: 'A rede trabalha e não registra.',
        alternativeReading: 'Sub-registro: consertar o fluxo antes de cobrar.',
        snapshot: { triageLevel: 5 },
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
      depth: 0,
    })
    fixtures.own('allocationDecision', dismissed.id)
    expect(await findP7()).toBeUndefined()

    // …until a NEWER postponement whose window already lapsed lets it resurface.
    const postponed = await payload.create({
      collection: 'allocationDecision',
      data: {
        municipality: municipality.id,
        patternId: 'P7',
        outcome: 'adiada',
        rationale: 'Adiado por 14 dias.',
        snapshot: {
          triageLevel: 5,
          suppressUntil: new Date(Date.now() - DAY_MS).toISOString(),
        },
      },
      depth: 0,
    })
    fixtures.own('allocationDecision', postponed.id)
    expect(await findP7()).toBeDefined()
  })

  it('hands the stagnation case to K-A once effort is recorded in the cycle', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    const activity = await payload.create({
      collection: 'activity',
      data: stub<ActivityCreateData>({
        title: fixtures.value('Caminhada Centro'),
        tags: ['Caminhada'],
        status: 'realizado',
        startAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
        municipality: municipality.id,
      }),
      depth: 0,
    })
    fixtures.own('activity', activity.id)

    const bundle = await suggestionsFor(coordinator, municipality.id)
    const byPattern = new Map(
      bundle.suggestions.map((suggestion) => [suggestion.patternId, suggestion]),
    )
    expect(byPattern.get('K-A')).toBeDefined()
    // The differential is exclusive: recorded effort means the sharper K-A
    // diagnosis speaks, never both.
    expect(byPattern.get('P7')).toBeUndefined()
  })

  it('fires P6 on a top-quartile município with zero network, prioritization raising its triage', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    // The evaluator's own cut convention, recomputed here so a drifting
    // artifact fails this line, not the loop below.
    const values = Array.from(computeAllMunicipalityPotentials().values())
      .map((potential) => potential.projectedValidVotes)
      .filter((value) => value > 0)
      .sort((left, right) => left - right)
    const upperCut = values[Math.min(Math.floor(values.length * 0.75), values.length - 1)] ?? 0

    let municipality: Municipality | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = await fixtures.getMunicipality()
      if (computeMunicipalityPotential(candidate.slug).projectedValidVotes >= upperCut) {
        municipality = candidate
        break
      }
    }
    if (!municipality) throw new Error('Nenhum município do quartil superior em 20 alocações.')

    await normalizeMunicipality(municipality)
    fixtures.touchMunicipality(municipality.id)

    const findP6 = async () => {
      const bundle = await suggestionsFor(coordinator, municipality!.id)
      return bundle.suggestions.find((suggestion) => suggestion.patternId === 'P6')
    }

    expect((await findP6())?.triageLevel).toBe(5)

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { priority: 'alta' },
      depth: 0,
    })
    expect((await findP6())?.triageLevel).toBe(3)

    // Any registered network kills the orphan reading.
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({ contact: contact.id, municipalities: [municipality.id] })
    expect(await findP6()).toBeUndefined()
  })

  it('scopes the queue to what the actor can read', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const leader = await fixtures.createCampaignUser('leader')

    const foreign = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, foreign)
    const administered = await fixtures.getMunicipality()
    await normalizeMunicipality(administered)
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    // The coordinator sees the foreign município's queue…
    const coordinatorBundle = await suggestionsFor(coordinator, foreign.id)
    expect(coordinatorBundle.suggestions.some((suggestion) => suggestion.patternId === 'P7')).toBe(
      true,
    )

    // …the advisor's full queue never leaves their portfolio…
    const advisorBundle = await suggestionsFor(advisor)
    expect(advisorBundle.evaluatedCount).toBe(1)
    for (const suggestion of advisorBundle.suggestions) {
      expect(suggestion.municipalityID).toBe(administered.id)
    }
    for (const entry of advisorBundle.silence) {
      expect(entry.municipalityID).toBe(administered.id)
    }

    // …asking for the foreign município directly evaluates nothing…
    const advisorForeign = await suggestionsFor(advisor, foreign.id)
    expect(advisorForeign.evaluatedCount).toBe(0)
    expect(advisorForeign.suggestions).toEqual([])

    // …and the leader (lockdown) cannot even open the queue: municipality read
    // access refuses outright. The staff-only route gates are what keep the
    // loader off a leader's request in the app.
    await expect(suggestionsFor(leader)).rejects.toThrow()
  })

  it('puts a prioritized silent município on the silence review, and a fresh signal takes it off', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    // A quiet município cannot be staged — quietness means NO artifact-anchored
    // pattern fires — so claim through the allocator until one qualifies
    // (measured: 205 of 435 with zeroed rows).
    let municipality: Municipality | null = null
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = await fixtures.getMunicipality()
      await normalizeMunicipality(candidate, { priority: 'alta' })
      fixtures.touchMunicipality(candidate.id)
      const bundle = await suggestionsFor(coordinator, candidate.id)
      const silent = bundle.silence.some((entry) => entry.municipalityID === candidate.id)
      if (bundle.suggestions.length === 0 && silent) {
        municipality = candidate
        break
      }
    }
    if (!municipality) throw new Error('Nenhum município silencioso em 10 alocações.')

    const author = await fixtures.createCampaignUser('coordinator')
    await fixtures.createMunicipalityUpdate({
      municipality: municipality.id,
      author: author.id,
      kind: 'nota',
      body: 'Conversa com o presidente do sindicato.',
    })

    const bundle = await suggestionsFor(coordinator, municipality.id)
    expect(bundle.silence.some((entry) => entry.municipalityID === municipality.id)).toBe(false)
  })
})

describe('resolveSuggestionRecord (E11)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const ownDecisions = async (
    fixtures: ReturnType<typeof campaignFixtures>,
    municipalityID: number,
  ) => {
    const decisions = await payload.find({
      collection: 'allocationDecision',
      where: { municipality: { equals: municipalityID } },
      sort: 'createdAt',
      depth: 0,
      pagination: false,
    })
    decisions.docs.forEach((decision) => fixtures.own('allocationDecision', decision.id))
    return decisions.docs
  }

  it('accepting records the chosen menu action with the decision-time snapshot', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    const { decision, postponeDays } = await resolveSuggestionRecord(payload, coordinator, {
      municipality: municipality.id,
      patternId: 'P7',
      outcome: 'aceita',
      chosenActionId: 'diagnostico-diferencial',
      note: 'Assessor confere com a rede até sexta.',
    })
    await ownDecisions(fixtures, municipality.id)

    expect(postponeDays).toBeNull()
    expect(decision.outcome).toBe('aceita')
    expect(decision.decidedBy).toBe(coordinator.id)
    expect(decision.rationale).toContain('Diagnóstico diferencial')
    expect(decision.rationale).toContain('Assessor confere')
    expect(decision.snapshot).toMatchObject({
      triageLevel: 5,
      scenario: 'central',
      chosenActionId: 'diagnostico-diferencial',
    })

    // The acceptance now suppresses the pattern on the next load.
    const bundle = await suggestionsFor(coordinator, municipality.id)
    expect(bundle.suggestions.some((suggestion) => suggestion.patternId === 'P7')).toBe(false)
  })

  it('clamps the composed rationale so a maximal note still records', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    // The note alone sits at the collection cap; the menu-label prefix would
    // push the composition past it and Payload would reject the create with a
    // message no retry could fix.
    const { decision } = await resolveSuggestionRecord(payload, coordinator, {
      municipality: municipality.id,
      patternId: 'P7',
      outcome: 'aceita',
      chosenActionId: 'diagnostico-diferencial',
      note: 'x'.repeat(2000),
    })
    await ownDecisions(fixtures, municipality.id)

    expect(decision.rationale).toHaveLength(2000)
    expect(decision.rationale).toContain('Diagnóstico diferencial')
  })

  it('postponing snoozes with a recorded suppressUntil', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    const { decision, postponeDays } = await resolveSuggestionRecord(payload, coordinator, {
      municipality: municipality.id,
      patternId: 'P7',
      outcome: 'adiada',
    })
    await ownDecisions(fixtures, municipality.id)

    // P7 sits on the optimization levels — the longer snooze.
    expect(postponeDays).toBe(14)
    const snapshot = decision.snapshot as { postponeDays?: number; suppressUntil?: string }
    expect(snapshot.postponeDays).toBe(14)
    expect(new Date(snapshot.suppressUntil ?? 0).getTime()).toBeGreaterThan(Date.now())

    const bundle = await suggestionsFor(coordinator, municipality.id)
    expect(bundle.suggestions.some((suggestion) => suggestion.patternId === 'P7')).toBe(false)
  })

  it('dismissing requires the alternative reading and a second resolve reads stale', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    await expect(
      resolveSuggestionRecord(payload, coordinator, {
        municipality: municipality.id,
        patternId: 'P7',
        outcome: 'descarta',
      }),
    ).rejects.toThrow()

    const { decision } = await resolveSuggestionRecord(payload, coordinator, {
      municipality: municipality.id,
      patternId: 'P7',
      outcome: 'descarta',
      alternativeReading: 'A rede trabalha e não registra — auditar antes.',
    })
    await ownDecisions(fixtures, municipality.id)
    expect(decision.alternativeReading).toContain('auditar antes')

    // The queue moved: deciding the same pattern again refuses as stale.
    await expect(
      resolveSuggestionRecord(payload, coordinator, {
        municipality: municipality.id,
        patternId: 'P7',
        outcome: 'aceita',
        chosenActionId: 'diagnostico-diferencial',
      }),
    ).rejects.toThrow(SUGGESTION_STALE_MESSAGE)
  })

  it('refuses a pattern that is not currently triggered, and an out-of-scope advisor', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await stageStalePledge(fixtures, municipality)

    // P6 needs zero network — this município has a leadership, so it is stale.
    await expect(
      resolveSuggestionRecord(payload, coordinator, {
        municipality: municipality.id,
        patternId: 'P6',
        outcome: 'aceita',
        chosenActionId: 'censo-rede',
      }),
    ).rejects.toThrow(SUGGESTION_STALE_MESSAGE)

    // The advisor does not administer this município: the scoped evaluation
    // sees nothing, so the resolve reads stale — existence never leaks.
    await expect(
      resolveSuggestionRecord(payload, advisor, {
        municipality: municipality.id,
        patternId: 'P7',
        outcome: 'aceita',
        chosenActionId: 'diagnostico-diferencial',
      }),
    ).rejects.toThrow(SUGGESTION_STALE_MESSAGE)

    expect(await ownDecisions(fixtures, municipality.id)).toHaveLength(0)
  })
})
