/**
 * E12 — intra-TI capture benchmark (T4) for municipality detail.
 *
 * Pure over the committed TSE artifact + `municipalityCatalog` (client-safe).
 * Peers share the same Território de Identidade; Metropolitano de Salvador
 * splits Salvador (all zone slugs) vs demais RMS municipalities — same rule as
 * E17/E12 rollups.
 */

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { medianOf } from '@/lib/median'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { captureRate } from '@/utilities/municipalityPotential'
import {
  METROPOLITANO_REGION,
  SALVADOR_CITY,
} from '@/utilities/territoryOverview'

type TerritoryCaptureBeacon = {
  slug: string
  name: string
  captureRate: number
}

export type MunicipalityIntraTerritoryCaptureBenchmark = {
  /** This municipality's 2022 capture rate, or null without a field ceiling. */
  captureRate: number | null
  /** Median capture among peers in the same TI (or Metropolitano sub-group). */
  medianCapture: number | null
  /**
   * `captureRate / medianCapture` when both exist — how many times above/below
   * the TI median (T4).
   */
  ratioToMedian: number | null
  /** Peer with the highest capture in the group (learning reference, not a scoreboard). */
  beacon: TerritoryCaptureBeacon | null
}

const peersForSlug = (slug: string): ReadonlyArray<(typeof municipalityCatalog)[number]> => {
  const entry = municipalityCatalog.find((row) => row.slug === slug)
  if (!entry) return []

  if (entry.region !== METROPOLITANO_REGION) {
    return municipalityCatalog.filter((row) => row.region === entry.region)
  }

  const isSalvadorZone = entry.city === SALVADOR_CITY
  return municipalityCatalog.filter((row) =>
    isSalvadorZone
      ? row.region === METROPOLITANO_REGION && row.city === SALVADOR_CITY
      : row.region === METROPOLITANO_REGION && row.city !== SALVADOR_CITY,
  )
}

/** T4 benchmark for one catalog slug — memoized per slug per process. */
const benchmarkBySlug = new Map<string, MunicipalityIntraTerritoryCaptureBenchmark>()

export const getMunicipalityIntraTerritoryCaptureBenchmark = (
  slug: string,
): MunicipalityIntraTerritoryCaptureBenchmark => {
  const cached = benchmarkBySlug.get(slug)
  if (cached) return cached

  const peers = peersForSlug(slug)
  const rates: Array<{ slug: string; name: string; rate: number }> = []

  for (const peer of peers) {
    const baseline = getMunicipalityFederalBaseline(peer.slug)
    const rate = captureRate(baseline)
    if (rate == null) continue
    rates.push({ slug: peer.slug, name: peer.name, rate })
  }

  const baseline = getMunicipalityFederalBaseline(slug)
  const municipalityCapture = captureRate(baseline)
  const medianCapture = medianOf(rates.map((entry) => entry.rate))

  let beacon: TerritoryCaptureBeacon | null = null
  for (const entry of rates) {
    if (!beacon || entry.rate > beacon.captureRate) {
      beacon = { slug: entry.slug, name: entry.name, captureRate: entry.rate }
    }
  }

  const ratioToMedian =
    municipalityCapture != null && medianCapture != null && medianCapture > 0
      ? municipalityCapture / medianCapture
      : null

  const result: MunicipalityIntraTerritoryCaptureBenchmark = {
    captureRate: municipalityCapture,
    medianCapture,
    ratioToMedian,
    beacon,
  }

  benchmarkBySlug.set(slug, result)
  return result
}
