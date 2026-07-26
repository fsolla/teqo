// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  getCampaignBottomNav,
  getCampaignNav,
  getCampaignSecondaryNav,
} from '@/components/campaign/shell/nav'
import {
  CAMPAIGN_CONCEPT_CATEGORIES,
  CAMPAIGN_CONCEPTS_PATH,
  campaignConceptHref,
  campaignConceptOneLiner,
  campaignConceptsByCategory,
  campaignIntelligenceConcepts,
} from '@/lib/campaignIntelligenceConcepts'

/**
 * The concept ids are URL anchors linked from tooltips across `/campanha`
 * (`campaignConceptHref`), so a duplicate or anchor-unsafe id ships a dead
 * "Saiba mais" link. Every concept must also belong to a rendered category —
 * otherwise the page silently drops it.
 */
describe('campaignIntelligenceConcepts', () => {
  it('has unique, anchor-safe ids', () => {
    const ids = campaignIntelligenceConcepts.map((concept) => concept.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('assigns every concept to a rendered category', () => {
    const categoryIDs = new Set(CAMPAIGN_CONCEPT_CATEGORIES.map((category) => category.id))
    for (const concept of campaignIntelligenceConcepts) {
      expect(categoryIDs).toContain(concept.categoryID)
    }
    const grouped = CAMPAIGN_CONCEPT_CATEGORIES.flatMap((category) =>
      campaignConceptsByCategory(category.id),
    )
    expect(grouped).toHaveLength(campaignIntelligenceConcepts.length)
  })

  it('documents what each number measures, how it is calculated, and where it shows up', () => {
    for (const concept of campaignIntelligenceConcepts) {
      expect(concept.title.length).toBeGreaterThan(0)
      expect(concept.oneLiner.length).toBeGreaterThan(0)
      expect(concept.formula.length).toBeGreaterThan(0)
      expect(concept.whyItMatters.length).toBeGreaterThan(0)
      expect(concept.whereItAppears.length).toBeGreaterThan(0)
    }
  })

  it('builds anchor hrefs into the concepts page', () => {
    expect(campaignConceptHref('cobertura-da-meta')).toBe('/campanha/conceitos#cobertura-da-meta')
  })

  it('quotes the same oneLiner the glossary page renders (B22 single source)', () => {
    const meta = campaignIntelligenceConcepts.find((concept) => concept.id === 'meta')
    expect(meta).toBeDefined()
    expect(campaignConceptOneLiner('meta')).toBe(meta!.oneLiner)
  })
})

/**
 * The sidebar entry is the only always-visible way in, so it carries the same
 * staff-only rule as the route itself — a `leader` offered the link would just
 * be bounced back to `/campanha`.
 */
describe('concepts sidebar entry', () => {
  it('is offered to staff and hidden from leaders', () => {
    expect(getCampaignSecondaryNav('coordinator').map((item) => item.href)).toEqual([
      CAMPAIGN_CONCEPTS_PATH,
    ])
    expect(getCampaignSecondaryNav('advisor')).not.toHaveLength(0)
    expect(getCampaignSecondaryNav('candidate')).not.toHaveLength(0)
    expect(getCampaignSecondaryNav('leader')).toHaveLength(0)
  })

  it('stays out of the work destinations and the mobile bottom bar', () => {
    const hrefs = [...getCampaignNav('coordinator'), ...getCampaignBottomNav('coordinator')].map(
      (item) => item.href,
    )

    expect(hrefs).not.toContain(CAMPAIGN_CONCEPTS_PATH)
  })
})
