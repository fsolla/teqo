/**
 * Territory panorama for the city report (C163) — where the município sits
 * inside its Território de Identidade, read from the committed TSE artifact.
 *
 * Pure by construction: no Payload, no network. The artifact is the same source
 * the app's rank/class cards read, so the PDF can never drift from the base.
 */

import {
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '../../src/lib/bahiaElectionAggregates.ts'
import {
  getMunicipalityCatalogEntry,
  municipalityCatalog,
} from '../../src/lib/municipalityCatalog.ts'

const DEFAULT_PANORAMA_YEAR = 2022

const votesFor = (slug, year) =>
  Number(getMunicipalityFederalBaseline(slug).votesByYear[String(year)] ?? 0)

/**
 * Region rollup + the município's dense rank inside it, for one year.
 * Returns null for a slug outside the catalog (never invent a region).
 */
export const buildTerritoryPanorama = (slug, year = DEFAULT_PANORAMA_YEAR) => {
  const entry = getMunicipalityCatalogEntry(slug)
  if (!entry) return null

  const regionSlugs = municipalityCatalog
    .filter((row) => row.region === entry.region)
    .map((row) => row.slug)
  const regionVotes = regionSlugs.reduce(
    (total, regionSlug) => total + votesFor(regionSlug, year),
    0,
  )
  const statewide = getStatewideFederalTotals(year)

  const rows = regionSlugs
    .map((regionSlug) => ({ slug: regionSlug, votes: votesFor(regionSlug, year) }))
    .sort((left, right) => {
      if (right.votes !== left.votes) return right.votes - left.votes
      return left.slug.localeCompare(right.slug)
    })

  let rank = 0
  let previousVotes
  let municipalityRank = null
  for (const row of rows) {
    if (row.votes !== previousVotes) {
      rank += 1
      previousVotes = row.votes
    }
    if (row.slug === slug) municipalityRank = rank
  }

  return {
    region: entry.region,
    year,
    municipalityCount: regionSlugs.length,
    regionVotes,
    regionShare: statewide.ownVotes > 0 ? regionVotes / statewide.ownVotes : null,
    municipalityVotes: votesFor(slug, year),
    municipalityRank,
    municipalityTotalUnits: rows.length,
  }
}
