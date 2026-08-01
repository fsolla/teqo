// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { formatVoteEstimateRange } from '@/lib/voteEstimate'
import config from '@/payload.config'
import {
  buildMunicipalityDetailTabHref,
  resolveMunicipalityDetailTab,
} from '@/utilities/municipality/municipalityDetailTabUi'
import {
  formatMunicipalityGeographyLabel,
  municipalityKindLabels,
} from '@/utilities/municipality/municipalityLabels'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { loadAdvisorSummaries } from '@/utilities/municipality/municipalityViewModels'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'
import {
  aggregateMunicipalityPledgesFromRows,
  toMunicipalityPledgeCoverageView,
} from '@/utilities/votePledgeViews'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('municipality detail characterization (OH8)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('pins the detail view model header fields staff surfaces reuse', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Detalhe'),
    })
    const municipality = await fixtures.getMunicipality()
    const lastUpdateAt = '2026-07-15T12:00:00.000Z'

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: {
        advisors: [advisor.id],
        lastUpdateAt,
      },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(municipality.id)

    const context = await resolveAccessibleMunicipalityContext(
      payload,
      coordinator,
      municipality.slug,
    )
    const view = await getMunicipalityDetailViewModel(payload, context, coordinator)
    const advisorSummaries = await loadAdvisorSummaries(payload, coordinator, view.advisorIDs)

    expect(view.name).toBe(municipality.name)
    expect(municipalityKindLabels[view.kind]).toBeTruthy()
    expect(formatMunicipalityGeographyLabel(view)).toBe(
      formatMunicipalityGeographyLabel({
        region: view.region,
        kind: view.kind,
        zoneNumber: view.zoneNumber,
      }),
    )
    expect(view.advisorIDs).toEqual([advisor.id])
    expect(advisorSummaries.map((entry) => entry.name)).toEqual([advisor.name])
    expect(view.lastUpdateAt).toBe(lastUpdateAt)
    expect(view.strategy).not.toBeNull()
  })

  it('pins pledge panel totals, scenario rollups, and estimate range', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    fixtures.touchMunicipality(municipality.id)

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 200,
      estimatedVotes: { pessimistic: 150, central: 180, optimistic: 220 },
    })

    const pledges = await loadMunicipalityPledges(payload, coordinator, municipality.id)
    const aggregate = aggregateMunicipalityPledgesFromRows(pledges)
    const coverage = toMunicipalityPledgeCoverageView(aggregate, 'central')

    expect(pledges).toHaveLength(1)
    expect(aggregate.declaredTotal).toBe(200)
    expect(aggregate.effectiveByScenario.pessimistic).toBe(150)
    expect(aggregate.effectiveByScenario.central).toBe(180)
    expect(aggregate.effectiveByScenario.optimistic).toBe(220)
    expect(coverage).toEqual({
      pledgeCount: 1,
      missingEstimateCount: 0,
      declaredTotal: 200,
      effectiveTotal: 180,
    })
    expect(formatVoteEstimateRange(pledges[0]!.estimatedVotes)).toBe('150–220')
  })

  it('pins resolved detail tabs and canonical hrefs', () => {
    expect(resolveMunicipalityDetailTab({})).toBe('overview')
    expect(resolveMunicipalityDetailTab({ tab: 'elections' })).toBe('elections')
    expect(resolveMunicipalityDetailTab({ newUpdate: '1' })).toBe('updates')
    expect(buildMunicipalityDetailTabHref('salvador-ze-01', 'leaderships', {})).toBe(
      '/campanha/municipios/salvador-ze-01?tab=leaderships',
    )
  })
})
