/**
 * People list display labels and the capacity enum (C100). Client-safe: a
 * plain string table, no Payload/DB — same contract as `leadershipLabels`.
 */

/** The three capacity facets — derived from the columns, OR within the facet. */
export const PEOPLE_CAPACITIES = ['assessora', 'lideranca', 'dobradinha'] as const

export type PeopleCapacity = (typeof PEOPLE_CAPACITIES)[number]

export const peopleCapacityLabels: Record<PeopleCapacity, string> = {
  assessora: 'É assessora',
  lideranca: 'É liderança',
  dobradinha: 'É dobradinha',
}
