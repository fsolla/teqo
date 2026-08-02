'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'

import type {
  OpsActivity,
  OpsDemand,
  OpsLeadership,
  OpsMunicipality,
  OpsMunicipalityUpdate,
  OpsOrganization,
  OpsStateDeputy,
} from '@/lib/campaignOps/opsContract'

const createRowCollection = <T extends { id: number }>(id: string) =>
  createCollection(
    localOnlyCollectionOptions<T, number>({
      id,
      getKey: (row) => row.id,
    }),
  )

/** Shared TanStack local collections — imported by outbox + mirror without a cycle. */
export const municipalitiesCollection = createRowCollection<OpsMunicipality>('ops-municipalities')
export const leadershipsCollection = createRowCollection<OpsLeadership>('ops-leaderships')
export const activitiesCollection = createRowCollection<OpsActivity>('ops-activities')
export const stateDeputiesCollection = createRowCollection<OpsStateDeputy>('ops-state-deputies')
export const organizationsCollection = createRowCollection<OpsOrganization>('ops-organizations')
export const demandsCollection = createRowCollection<OpsDemand>('ops-demands')
export const municipalityUpdatesCollection = createRowCollection<OpsMunicipalityUpdate>(
  'ops-municipality-updates',
)
