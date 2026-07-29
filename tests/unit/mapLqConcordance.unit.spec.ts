import { describe, expect, it } from 'vitest'

import {
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '@/lib/bahiaElectionAggregates'
import { ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'

/**
 * B13+ F1 — the map panel computes LQ client-side; E10 classifies server-side
 * over the same artifact. E15 will touch the anchors — this pin is the safety
 * net that both paths still agree on the ratio.
 */
const mapLqForSlug = (slug: string, year: number): number | null => {
  const baseline = getMunicipalityFederalBaseline(slug)
  const votes = baseline.votesByYear[String(year)] ?? 0
  const validVotes = baseline.validVotesByYear[String(year)] ?? 0
  const statewide = getStatewideFederalTotals(year)
  const statewideShare = statewide.validVotes > 0 ? statewide.ownVotes / statewide.validVotes : 0

  if (votes <= 0 || validVotes <= 0 || statewideShare <= 0) return null

  return votes / validVotes / statewideShare
}

const firstSlugWithFederalVotes2022 = (): string => {
  const slug = municipalityCatalog.find((entry) => {
    const baseline = getMunicipalityFederalBaseline(entry.slug)
    return (baseline.votesByYear[String(ELECTION_YEAR_2022)] ?? 0) > 0
  })?.slug

  if (!slug) {
    throw new Error('expected at least one municipality with 2022 federal votes in the catalog')
  }
  return slug
}

describe('map LQ concordance (B13+ F1)', () => {
  it('matches computeMunicipalityTerritorialClass.lq for a municipality with 2022 votes', () => {
    const slug = firstSlugWithFederalVotes2022()

    const mapLq = mapLqForSlug(slug, ELECTION_YEAR_2022)
    const classifierLq = computeMunicipalityTerritorialClass(slug).lq

    expect(mapLq).not.toBeNull()
    expect(classifierLq).not.toBeNull()
    if (mapLq === null || classifierLq === null) return

    expect(mapLq).toBeCloseTo(classifierLq, 10)
  })

  it('uses the same statewide standard as the classifier inputs', () => {
    const slug = firstSlugWithFederalVotes2022()
    const totals = getStatewideFederalTotals(ELECTION_YEAR_2022)
    const statewideShare = totals.validVotes > 0 ? totals.ownVotes / totals.validVotes : 0

    const baseline = getMunicipalityFederalBaseline(slug)
    const ownVotes = baseline.votesByYear[String(ELECTION_YEAR_2022)] ?? 0
    const validVotes = baseline.validVotesByYear[String(ELECTION_YEAR_2022)] ?? 0

    expect(ownVotes).toBeGreaterThan(0)
    expect(validVotes).toBeGreaterThan(0)
    expect(statewideShare).toBeGreaterThan(0)

    const expectedLq = ownVotes / validVotes / statewideShare
    const classifierLq = computeMunicipalityTerritorialClass(slug).lq

    expect(classifierLq).not.toBeNull()
    if (classifierLq === null) return

    expect(classifierLq).toBeCloseTo(expectedLq, 10)
  })
})
