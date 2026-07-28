// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadMunicipalityVisitEligibility, loadVisitCandidates } from '@/utilities/visitPlannerData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/**
 * E13's loader is the one place where visit eligibility meets real rows: the
 * access scope, the per-município leadership count (one query, never N), and
 * the two fields the planner has its OWN `municipality` select for —
 * `politicalTrend` and `stateDeputies`, which nothing in
 * `loadMunicipalityScope` carries.
 *
 * The peer count and the ordering are pure and pinned in
 * `visitEligibility.unit.spec.ts` / `visitPlannerViews.unit.spec.ts`; what an
 * advisor's portfolio contains cannot be, because it is a `where` clause.
 */
describe('loadVisitCandidates', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('never hands an advisor a município outside the portfolio they administer', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    const foreign = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered, [advisor.id])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [foreign.id],
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: foreign.id,
      declaredVotes: 900,
    })

    const bundle = await loadVisitCandidates(payload, advisor)
    const slugs = bundle.groups.flatMap((group) =>
      group.candidates.map((candidate) => candidate.slug),
    )

    expect(slugs).toEqual([administered.slug])
    // Every group is one identity territory, and every candidate belongs to it.
    for (const group of bundle.groups) {
      for (const candidate of group.candidates) expect(candidate.region).toBe(group.region)
    }
  })

  it('counts one liderança linked to several municípios in each of them', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(first, [advisor.id])
    await fixtures.assignMunicipalityAdvisors(second, [advisor.id])

    const shared = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: shared.id,
      municipalities: [first.id, second.id],
    })
    const extra = await fixtures.createContact()
    await fixtures.createLeadership({ contact: extra.id, municipalities: [first.id] })

    const bundle = await loadVisitCandidates(payload, advisor)
    const bySlug = new Map(
      bundle.groups
        .flatMap((group) => group.candidates)
        .map((candidate) => [candidate.slug, candidate]),
    )

    expect(bySlug.get(first.slug)?.leadershipCount).toBe(2)
    expect(bySlug.get(second.slug)?.leadershipCount).toBe(1)
  })

  it('reads the janela política from politicalTrend and stateDeputies', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor.id])
    fixtures.touchMunicipality(municipality)

    const janelaOf = async () => {
      const bundle = await loadVisitCandidates(payload, advisor)
      const candidate = bundle.groups[0]?.candidates[0]
      const janela = candidate?.eligibility.conditions.find(
        (condition) => condition.id === 'janela',
      )
      if (!janela) throw new Error('Condição de janela política ausente')
      return janela
    }

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { politicalTrend: { status: 'desfavoravel' } },
    })
    expect((await janelaOf()).met).toBe(false)

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { politicalTrend: { status: 'favoravel' } },
    })
    expect((await janelaOf()).met).toBe(true)

    // A linked dobradinha carries the window even against an adverse trend.
    const deputy = await fixtures.createStateDeputy()
    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { politicalTrend: { status: 'desfavoravel' }, stateDeputies: [deputy.id] },
    })
    const janela = await janelaOf()
    expect(janela.met).toBe(true)
    expect(janela.detail).toContain('dobradinha')
  })

  it('never counts a município as its own tour peer, and carries the pledge stock', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor.id])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 150,
      estimatedVotes: { pessimistic: null, central: 220, optimistic: null },
    })

    const { candidate } = await loadMunicipalityVisitEligibility(
      payload,
      advisor,
      municipality.slug,
    )

    expect(candidate?.pledgeCount).toBe(1)
    expect(candidate?.coverage.committed).toBe(220)
    // The portfolio holds this município alone: it has a stop, but no peer to
    // pair with — so "encaixe em giro" must read as unmet, not as self-met.
    const encaixe = candidate?.eligibility.conditions.find(
      (condition) => condition.id === 'encaixe',
    )
    expect(encaixe?.met).toBe(false)
  })
})
