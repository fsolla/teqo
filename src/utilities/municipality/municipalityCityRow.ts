import 'server-only'

import { SALVADOR_CITY_SLUG, salvadorCity } from '@/lib/salvadorCity'
import type { Municipality } from '@/payload-types'
import { NO_PARTY_FILTER_VALUE, splitAbsenceFilterValues } from '@/utilities/campaignListUrl'
import {
  NO_LEADERSHIP_FILTER_VALUE,
  NO_LEVEL_FILTER_VALUE,
  NO_STATE_DEPUTY_FILTER_VALUE,
  type MunicipalityListSortDirection,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import {
  computeAggregateTerritorialClass,
  type MunicipalityTerritorialClassification,
} from '@/utilities/municipality/municipalityTerritorialClass'

/**
 * B178 — the Salvador city row of the municipality list: filter predicate,
 * synthetic document and native-sort insertion. The city is a DERIVED surface
 * (never a DB row — see `lib/salvadorCity.ts`), so every dimension of the
 * frozen URL contract that WOULD select a normal municipality with the city's
 * virtual values must select the city row too.
 */

/** Stable sentinel id of the synthetic city document — never a DB id. */
export const CITY_MUNICIPALITY_ID = -1 as const

/** Whether the free-text search matches the city's display name (mirrors the DB `name contains`). */
const cityMatchesQuery = (q: string): boolean => {
  const needle = q.toLowerCase()
  const name = salvadorCity.name.toLowerCase()
  return name.includes(needle)
}

/**
 * Mirrors `buildMunicipalityListWhere` semantics over the city's VIRTUAL
 * values: the city has no advisors, trend, level, dobradinhas, leaderships or
 * parties, so it only survives the dimensions that select absence, plus the
 * ones where it carries real derived values (name, region, slug, class).
 */
export const cityMatchesFilter = (state: MunicipalityListState): boolean => {
  if (state.q && !cityMatchesQuery(state.q)) return false
  if (state.regions?.length && !state.regions.includes(salvadorCity.region)) return false
  if (state.slugs?.length && !state.slugs.includes(SALVADOR_CITY_SLUG)) return false
  if (state.advisors?.length) return false
  if (state.coverage && state.coverage !== 'sem_assessor') return false
  if (state.priority) return false
  if (state.trends?.length) return false
  if (state.classes?.length && !state.classes.includes(cityTerritorialClass().class)) return false
  if (state.levels?.length) {
    const { named, hasAbsence } = splitAbsenceFilterValues(
      state.levels,
      (level) => level === NO_LEVEL_FILTER_VALUE,
    )
    if (named.length || !hasAbsence) return false
  }
  if (state.stateDeputies?.length) {
    const { named, hasAbsence } = splitAbsenceFilterValues(
      state.stateDeputies,
      (value) => value === NO_STATE_DEPUTY_FILTER_VALUE,
    )
    if (named.length || !hasAbsence) return false
  }
  if (state.leaderships?.length) {
    const { named, hasAbsence } = splitAbsenceFilterValues(
      state.leaderships,
      (value) => value === NO_LEADERSHIP_FILTER_VALUE,
    )
    if (named.length || !hasAbsence) return false
  }
  if (state.parties?.length) {
    const { named, hasAbsence } = splitAbsenceFilterValues(
      state.parties,
      (party) => party === NO_PARTY_FILTER_VALUE,
    )
    if (named.length || !hasAbsence) return false
  }
  return true
}

/**
 * The class of the 19 zones read as one territory — the SAME classifier the
 * TI rollup uses (`computeAggregateTerritorialClass`), never an average of
 * per-zone classes: LQ is a ratio, and the ratio of the sums is the honest
 * reading for the capital.
 */
export const cityTerritorialClass = (): MunicipalityTerritorialClassification =>
  computeAggregateTerritorialClass(salvadorCity.zoneSlugs)

/**
 * Synthetic `Municipality`-shaped document for the list machinery: fields the
 * view model reads carry the city's virtual values, everything operational is
 * absent (no advisors/trend/level/…), and the sentinel id guarantees no
 * interactive control can ever target a real row. Never persisted.
 */
export const buildCityMunicipalityDoc = (): Municipality => ({
  id: CITY_MUNICIPALITY_ID,
  name: salvadorCity.name,
  slug: salvadorCity.slug,
  kind: 'municipio',
  city: salvadorCity.city,
  region: salvadorCity.region,
  ibgeCode: salvadorCity.ibgeCode,
  tseCityCode: salvadorCity.tseCityCode,
  zoneNumber: null,
  advisors: [],
  stateDeputies: [],
  priority: 'normal',
  engagementLevel: null,
  levelNote: null,
  levelChangedAt: null,
  lastUpdateAt: null,
  updatedAt: '',
  createdAt: '',
})

/**
 * Inserts the city row at its native-sort position WITHOUT re-sorting the rest
 * of the list: the DB docs already carry the SQL order, and a full in-memory
 * re-sort would drift collation (accents etc.). Only the city is compared —
 * name/region by pt-BR collation; `lastUpdateAt`/`trend` have null city values
 * and sort last in both directions (the app convention for nulls).
 */
export const insertCityAtNativeSortPosition = (
  docs: readonly Municipality[],
  city: Municipality,
  sortKey: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): Municipality[] => {
  if (sortKey !== 'name' && sortKey !== 'region') return [...docs, city]
  const compareToCity = (doc: Municipality): number =>
    sortKey === 'name'
      ? doc.name.localeCompare(city.name, 'pt-BR')
      : doc.region.localeCompare(city.region, 'pt-BR')
  const ascending = dir === 'asc'
  const index = docs.findIndex((doc) =>
    ascending ? compareToCity(doc) > 0 : compareToCity(doc) < 0,
  )
  if (index === -1) return [...docs, city]
  return [...docs.slice(0, index), city, ...docs.slice(index)]
}
