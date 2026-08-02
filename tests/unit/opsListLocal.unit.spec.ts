import { describe, expect, it } from 'vitest'

import type {
  OpsDemand,
  OpsLeadership,
  OpsMunicipality,
  OpsOrganization,
  OpsStateDeputy,
} from '@/lib/campaignOps/opsContract'
import {
  filterSortPageOpsDemands,
  filterSortPageOpsLeaderships,
  filterSortPageOpsOrganizations,
  filterSortPageOpsStateDeputies,
} from '@/utilities/campaignOps/opsEntityListLocal'
import { filterSortPageOpsMunicipalities } from '@/utilities/campaignOps/opsMunicipalityListLocal'

const municipality = (
  partial: Partial<OpsMunicipality> & Pick<OpsMunicipality, 'id' | 'slug' | 'name'>,
): OpsMunicipality => ({
  kind: 'municipio',
  city: partial.name,
  region: 'Portal do Sertão',
  ibgeCode: '2910800',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...partial,
})

describe('filterSortPageOpsMunicipalities (OH12)', () => {
  const rows = [
    municipality({
      id: 1,
      slug: 'feira-de-santana',
      name: 'Feira de Santana',
      advisors: [10],
      priority: 'alta',
      politicalTrend: { status: 'favoravel' },
      engagementLevel: 'n3',
      expectedVotes: { central: 200 },
    }),
    municipality({
      id: 2,
      slug: 'alagoinhas',
      name: 'Alagoinhas',
      region: 'Litoral Norte e Agreste Baiano',
      advisors: [],
      politicalTrend: { status: 'neutra' },
      engagementLevel: 'n1',
      expectedVotes: { central: 50 },
    }),
    municipality({
      id: 3,
      slug: 'salvador-ze-1',
      name: 'Salvador — ZE 1',
      kind: 'zona',
      city: 'Salvador',
      region: 'Metropolitana de Salvador',
      zoneNumber: 1,
      advisors: [10, 11],
    }),
  ]

  it('filters by q on name and paginates', () => {
    const result = filterSortPageOpsMunicipalities(rows, {
      page: 1,
      q: 'feira',
      sort: 'name',
      dir: 'asc',
    })
    expect(result.rows.map((row) => row.slug)).toEqual(['feira-de-santana'])
    expect(result.totalDocs).toBe(1)
    expect(result.classFilterUnavailable).toBe(false)
    expect(result.sortDegraded).toBe(false)
  })

  it('filters coverage / priority / trend / level from mirror fields', () => {
    const result = filterSortPageOpsMunicipalities(rows, {
      page: 1,
      coverage: 'sem_assessor',
      sort: 'name',
      dir: 'asc',
    })
    expect(result.rows.map((row) => row.slug)).toEqual(['alagoinhas'])

    const priority = filterSortPageOpsMunicipalities(rows, {
      page: 1,
      priority: 'alta',
      sort: 'name',
      dir: 'asc',
    })
    expect(priority.rows.map((row) => row.slug)).toEqual(['feira-de-santana'])
  })

  it('marks classe filter and server-only sorts as unavailable / degraded', () => {
    const withClass = filterSortPageOpsMunicipalities(rows, {
      page: 1,
      classes: ['reduto'],
      sort: 'deficit',
      dir: 'desc',
    })
    expect(withClass.classFilterUnavailable).toBe(true)
    expect(withClass.sortDegraded).toBe(true)
    // Degraded sort falls back to name asc
    expect(withClass.rows.map((row) => row.slug)).toEqual([
      'alagoinhas',
      'feira-de-santana',
      'salvador-ze-1',
    ])
  })
})

describe('ops entity list local helpers (OH12)', () => {
  it('filters leaderships by q and status', () => {
    const rows: OpsLeadership[] = [
      {
        id: 1,
        contact: { id: 1, name: 'Ana' },
        municipalities: [10],
        supportStatus: 'engajado',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 2,
        contact: { id: 2, name: 'Bruno' },
        municipalities: [11],
        supportStatus: 'a_abordar',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]
    const result = filterSortPageOpsLeaderships(rows, {
      page: 1,
      q: 'ana',
      statuses: ['engajado'],
      sort: 'name',
      dir: 'asc',
    })
    expect(result.rows.map((row) => row.id)).toEqual([1])
  })

  it('filters state deputies, organizations and demands', () => {
    const deputies: OpsStateDeputy[] = [
      { id: 1, name: 'João', slug: 'joao', party: 'PT', updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 2, name: 'Maria', slug: 'maria', party: null, updatedAt: '2026-08-01T00:00:00.000Z' },
    ]
    expect(
      filterSortPageOpsStateDeputies(deputies, {
        page: 1,
        q: 'mar',
        sort: 'name',
        dir: 'asc',
      }).rows.map((row) => row.slug),
    ).toEqual(['maria'])

    const orgs: OpsOrganization[] = [
      {
        id: 1,
        name: 'Sindicato A',
        slug: 'sindicato-a',
        kind: 'sindicato',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Associação B',
        slug: 'associacao-b',
        kind: 'associacao',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    expect(
      filterSortPageOpsOrganizations(orgs, { page: 1, kind: 'sindicato' }).rows.map(
        (row) => row.slug,
      ),
    ).toEqual(['sindicato-a'])

    const demands: OpsDemand[] = [
      {
        id: 1,
        title: 'Material',
        slug: 'material',
        kind: 'material',
        municipality: 1,
        status: 'aberta',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 2,
        title: 'Transporte',
        slug: 'transporte',
        kind: 'transporte',
        municipality: 1,
        status: 'aprovada',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    expect(
      filterSortPageOpsDemands(demands, { page: 1, status: 'aberta' }).rows.map((row) => row.slug),
    ).toEqual(['material'])
  })
})
