import { statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FEDERAL_BASELINE_CANDIDATE_NUMBER,
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { BASELINE_TICKET_2022, ELECTION_YEAR_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'

const ARTIFACT_PATH = join(
  process.cwd(),
  'src/lib/electionAggregates/bahia-federal-baseline.json',
)

/**
 * Pins the committed election-aggregate artifact to the municipality catalog.
 * If either changes shape (new remodel, new TSE scope), regenerate with
 * `pnpm build:election-aggregates` — a drift here means the map would render
 * zeros silently.
 */
describe('election aggregates artifact', () => {
  it('covers exactly the municipality catalog slugs', () => {
    const artifactSlugs = new Set(federalBaselineMunicipalitySlugs())
    const catalogSlugs = new Set(municipalityCatalog.map((entry) => entry.slug))

    expect(artifactSlugs.size).toBe(catalogSlugs.size)
    for (const slug of catalogSlugs) {
      expect(artifactSlugs.has(slug)).toBe(true)
    }
  })

  it('is generated for the baseline ticket candidate', () => {
    expect(FEDERAL_BASELINE_CANDIDATE_NUMBER).toBe(BASELINE_TICKET_2022.candidate.candidateNumber)
  })

  it('has every historical year populated with plausible statewide totals', () => {
    for (const year of HISTORICAL_SERIES_YEARS) {
      let candidateTotal = 0
      let validTotal = 0
      for (const slug of federalBaselineMunicipalitySlugs()) {
        const baseline = getMunicipalityFederalBaseline(slug)
        const votes = baseline.votesByYear[String(year)]
        const valid = baseline.validVotesByYear[String(year)]
        expect(votes).toBeTypeOf('number')
        expect(valid).toBeTypeOf('number')
        expect(votes).toBeGreaterThanOrEqual(0)
        expect(valid).toBeGreaterThanOrEqual(votes > 0 ? 1 : 0)
        candidateTotal += votes ?? 0
        validTotal += valid ?? 0
      }
      // A statewide federal-deputy campaign always lands in the 5-7 digit range.
      expect(candidateTotal).toBeGreaterThan(10_000)
      expect(validTotal).toBeGreaterThan(candidateTotal)
    }
  })

  it('returns an empty baseline for unknown slugs', () => {
    const baseline = getMunicipalityFederalBaseline('nao-existe')
    expect(baseline.votesByYear).toEqual({})
    expect(baseline.validVotesByYear).toEqual({})
    expect(baseline.campoFederalVotesByYear).toEqual({})
    expect(baseline.federalTallyByYear).toEqual({})
    expect(baseline.majoritarian2022).toBeUndefined()
  })

  it('has campo federal votes + federal tally for every historical year (v2 fields)', () => {
    for (const year of HISTORICAL_SERIES_YEARS) {
      let campoTotal = 0
      let tallyComparecimentoTotal = 0
      for (const slug of federalBaselineMunicipalitySlugs()) {
        const baseline = getMunicipalityFederalBaseline(slug)
        const campo = baseline.campoFederalVotesByYear[String(year)]
        const tally = baseline.federalTallyByYear[String(year)]
        expect(campo).toBeTypeOf('number')
        expect(campo).toBeGreaterThanOrEqual(0)
        expect(tally).toBeDefined()
        expect(tally.comparecimento).toBeGreaterThanOrEqual(0)
        expect(tally.votosValidos).toBeGreaterThanOrEqual(0)
        campoTotal += campo ?? 0
        tallyComparecimentoTotal += tally?.comparecimento ?? 0
      }
      // The campo (PT + core-left partners) always outpolls Solla alone, and
      // turnout always dwarfs any single candidate's nominal votes.
      expect(campoTotal).toBeGreaterThan(10_000)
      expect(tallyComparecimentoTotal).toBeGreaterThan(campoTotal)
    }
  })

  it('has 2022 majoritarian (presidente/governador #13) votes+tally for every municipality', () => {
    let presidentTotal = 0
    for (const slug of federalBaselineMunicipalitySlugs()) {
      const baseline = getMunicipalityFederalBaseline(slug)
      const majoritarian = baseline.majoritarian2022
      expect(majoritarian).toBeDefined()
      if (!majoritarian) continue
      expect(majoritarian.president.votes).toBeGreaterThanOrEqual(0)
      expect(majoritarian.governor.votes).toBeGreaterThanOrEqual(0)
      expect(majoritarian.president.comparecimento).toBeGreaterThanOrEqual(majoritarian.president.votes)
      presidentTotal += majoritarian.president.votes
    }
    expect(presidentTotal).toBeGreaterThan(10_000)
    // Sanity: the 2022 majoritarian slice must not silently regress to a
    // different election year (only 2022 is seeded/expected here).
    expect(HISTORICAL_SERIES_YEARS).toContain(ELECTION_YEAR_2022)
  })

  it('stays under the committed artifact byte budget', () => {
    const { size } = statSync(ARTIFACT_PATH)
    // v1 (votes + valid votes only) was ~96 KB; v2 adds campo votes, federal
    // tally and the 2022 majoritarian slice, measured at ~522 KB — budget
    // with headroom, not a precise pin, so future fields don't require
    // touching this test.
    expect(size).toBeLessThan(700 * 1024)
  })
})
